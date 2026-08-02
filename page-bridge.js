(() => {
  "use strict";

  if (window.__nlfytBridgeLoaded) return;
  window.__nlfytBridgeLoaded = true;

  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-rich-grid-media",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-radio-renderer",
    "ytd-reel-item-renderer",
    "ytd-structured-description-video-lockup-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model"
  ].join(",");

  const STATE_EVENT = "nlfyt:player-state";
  const SKIP_EVENT = "nlfyt:skip-current";
  let reportTimer;
  let lastUserIntentAt = 0;
  let lastEndedAt = 0;
  let lastVideoId = null;
  let automaticNavigation = false;
  let forcedSkipChainUntil = 0;

  const PAST_STREAM_PATTERNS = [
    /\bstreamed\b.*\bago\b/i,
    /\btransmitowano\b/i,
    /\bgestreamt\b/i,
    /\bdiffus[ée]\b.*\bil y a\b/i,
    /\bemitido\b.*\bhace\b/i,
    /\btransmitido\b.*\bh[áa]\b/i,
    /\btrasmesso in streaming\b/i,
    /\bgestreamd\b/i,
    /\bstreamades\b/i,
    /\bstreamet\b/i,
    /\bstriimattu\b/i,
    /трансляци[яії]/i,
    /ライブ配信/i,
    /스트리밍/i,
    /直播/i
  ];

  function getPlayer() {
    return document.getElementById("movie_player");
  }

  function getVideoIdFromUrl() {
    return location.pathname.startsWith("/watch")
      ? new URL(location.href).searchParams.get("v")
      : null;
  }

  function navigationLooksAutomatic() {
    const player = getPlayer();
    const video = document.querySelector("video");
    const playerEnded = player?.getPlayerState?.() === 0;
    const nearEnd = Boolean(
      video && Number.isFinite(video.duration) && video.duration > 0 &&
      video.duration - video.currentTime < 4
    );
    return Date.now() < forcedSkipChainUntil || (
      Date.now() - lastUserIntentAt > 5000 &&
      (playerEnded || nearEnd || Date.now() - lastEndedAt < 15000)
    );
  }

  function getLiveState() {
    const player = getPlayer();
    const video = document.querySelector("video");
    const videoData = player?.getVideoData?.();
    const response = player?.getPlayerResponse?.() || window.ytInitialPlayerResponse;
    const details = response?.videoDetails;
    const microformat = response?.microformat?.playerMicroformatRenderer;
    const broadcast = microformat?.liveBroadcastDetails;
    const scheduledStart = Date.parse(broadcast?.startTimestamp || "");
    const videoId = videoData?.video_id || details?.videoId || getVideoIdFromUrl();
    const hasLivePlayer = Boolean(
      video?.duration === Infinity ||
      player?.classList?.contains("ytp-live") ||
      document.querySelector("ytd-watch-flexy[is-live]")
    );

    const isLive = Boolean(
        videoData?.isLive ||
        details?.isLive ||
        broadcast?.isLiveNow ||
        hasLivePlayer
      );
    const isUpcoming = Boolean(
        Number.isFinite(scheduledStart) &&
        scheduledStart > Date.now() &&
        !broadcast?.isLiveNow &&
        !broadcast?.endTimestamp
      );

    return {
      videoId,
      automaticNavigation,
      isLive,
      isUpcoming,
      isPastLive: Boolean(
        !isLive &&
        !isUpcoming &&
        (details?.isLiveContent || broadcast?.endTimestamp)
      )
    };
  }

  function reportState() {
    if (!location.pathname.startsWith("/watch")) return;
    document.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: getLiveState() }));
  }

  function scheduleReports() {
    clearTimeout(reportTimer);
    let attempts = 0;
    const report = () => {
      reportState();
      attempts += 1;
      if (attempts < 12) reportTimer = setTimeout(report, attempts < 4 ? 250 : 750);
    };
    report();
  }

  function classifyData(rootData) {
    if (!rootData || typeof rootData !== "object") return null;
    const seen = new Set();
    const stack = [rootData];
    let inspected = 0;
    let upcoming = false;
    let past = false;

    while (stack.length && inspected < 2500) {
      const value = stack.pop();
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      inspected += 1;

      for (const [key, child] of Object.entries(value)) {
        const normalizedKey = key.toLowerCase();
        if (child === true && (normalizedKey === "islivenow" || normalizedKey === "islive")) return "live";
        if (child === true && normalizedKey === "islivecontent") past = true;
        if (normalizedKey.includes("upcomingevent") && child) upcoming = true;

        if ((normalizedKey === "publishedtimetext" || normalizedKey === "publishedtimelabel") && child) {
          let publishedText = "";
          try {
            publishedText = typeof child === "string" ? child : JSON.stringify(child);
          } catch {}
          if (PAST_STREAM_PATTERNS.some((pattern) => pattern.test(publishedText))) past = true;
        }

        if (typeof child === "string" && (
          normalizedKey === "style" || normalizedKey.includes("badgestyle") ||
          normalizedKey === "overlaystyle" || normalizedKey === "icontype"
        )) {
          const marker = child.toUpperCase();
          if (marker.includes("LIVE_NOW") || marker === "LIVE") return "live";
          if (marker.includes("UPCOMING")) upcoming = true;
        } else if (child && typeof child === "object") {
          stack.push(child);
        }
      }
    }
    if (upcoming) return "upcoming";
    return past ? "past" : null;
  }

  function markCard(card) {
    if (!(card instanceof Element) || !card.matches(CARD_SELECTOR)) return;
    const dataCandidates = [card.data, card.componentData, card.__data, card.__dataHost?.data];
    let type = null;
    for (const data of dataCandidates) {
      const detected = classifyData(data);
      if (detected === "live") {
        type = "live";
        break;
      }
      if (detected === "upcoming") type = "upcoming";
    }
    if (type) card.setAttribute("data-nlfyt-stream", type);
    else card.removeAttribute("data-nlfyt-stream");
  }

  function markCardsNear(node) {
    if (!(node instanceof Element)) return;
    const card = node.matches(CARD_SELECTOR) ? node : node.closest(CARD_SELECTOR);
    if (card) markCard(card);
    node.querySelectorAll?.(CARD_SELECTOR).forEach(markCard);
  }

  function noteUserIntent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('a[href*="/watch"], .ytp-next-button, .ytp-autonav-endscreen-upnext-play-button')) {
      lastUserIntentAt = Date.now();
    }
  }

  document.addEventListener("pointerdown", noteUserIntent, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") noteUserIntent(event);
  }, true);
  document.addEventListener("ended", () => {
    lastEndedAt = Date.now();
  }, true);
  document.addEventListener("yt-navigate-start", () => {
    automaticNavigation = navigationLooksAutomatic();
  });
  document.addEventListener("yt-navigate-finish", () => {
    scheduleReports();
    document.querySelectorAll(CARD_SELECTOR).forEach(markCard);
  });

  document.addEventListener(SKIP_EVENT, () => {
    forcedSkipChainUntil = Date.now() + 20000;
    automaticNavigation = true;
    const player = getPlayer();
    if (typeof player?.nextVideo === "function") player.nextVideo();
    else document.querySelector(".ytp-next-button")?.click();
  });

  function initializeObserver() {
    if (!document.documentElement) {
      setTimeout(initializeObserver, 0);
      return;
    }
    document.documentElement.setAttribute("data-nlfyt-bridge", "1.3.0");
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        markCardsNear(mutation.target);
        mutation.addedNodes.forEach(markCardsNear);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  setInterval(() => {
    const videoId = getVideoIdFromUrl();
    if (videoId && videoId !== lastVideoId) {
      if (lastVideoId) automaticNavigation = navigationLooksAutomatic();
      lastVideoId = videoId;
      scheduleReports();
    }
  }, 500);

  // Safety pass for renderer experiments that replace data without adding a child node.
  setInterval(() => document.querySelectorAll(CARD_SELECTOR).forEach(markCard), 3000);

  initializeObserver();
  document.querySelectorAll(CARD_SELECTOR).forEach(markCard);
  scheduleReports();
})();
