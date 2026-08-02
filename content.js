(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    hideUpcoming: true,
    hidePastStreams: true,
    skipAutoplay: true
  };

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

  const LIVE_MARKER_SELECTOR = [
    '[data-nlfyt-stream="live"]',
    'ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"]',
    '[badge-style-type="LIVE_NOW"]',
    '[badge-style-type="BADGE_STYLE_TYPE_LIVE_NOW"]',
    ".badge-style-type-live-now",
    ".yt-badge-shape--live",
    '[class*="badge-shape-wiz--live"]',
    '[class*="badge-shape-wiz--thumbnail-live"]'
  ].join(",");

  const UPCOMING_MARKER_SELECTOR = [
    '[data-nlfyt-stream="upcoming"]',
    'ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"]',
    '[badge-style-type="UPCOMING"]',
    '[badge-style-type="BADGE_STYLE_TYPE_UPCOMING"]',
    ".badge-style-type-upcoming",
    '[class*="badge-shape-wiz--upcoming"]'
  ].join(",");

  const BADGE_SELECTOR = [
    "ytd-badge-supported-renderer",
    "yt-thumbnail-overlay-badge-view-model",
    "yt-badge-shape",
    "ytd-thumbnail-overlay-time-status-renderer",
    ".badge-shape-wiz"
  ].join(",");

  const LIVE_LABELS = new Set([
    "LIVE", "LIVE NOW", "NA ŻYWO", "EN DIRECT", "EN DIRECTO", "AO VIVO",
    "JETZT LIVE", "IN DIRETTA", "В ЭФИРЕ", "ライブ配信中", "실시간"
  ]);
  const UPCOMING_LABELS = new Set(["UPCOMING", "ZAPLANOWANO", "PREMIERE IN"]);
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

  let settings = { ...DEFAULTS };
  let fullScanQueued = false;
  let cardScanQueued = false;
  let lastUserNavigationAt = 0;
  let lastVideoEndedAt = 0;
  let autoplayNavigation = false;
  let skipChainUntil = 0;
  const pendingCards = new Set();
  const skippedVideoIds = new Set();

  function getVideoId() {
    if (!location.pathname.startsWith("/watch")) return null;
    return new URL(location.href).searchParams.get("v");
  }

  function normalizedBadgeText(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function hasBadgeLabel(card, labels) {
    return [...card.querySelectorAll(BADGE_SELECTOR)].some((badge) => {
      const text = normalizedBadgeText(badge);
      return labels.has(text);
    });
  }

  function hasPastStreamLabel(card) {
    const metadata = card.querySelectorAll([
      "#metadata-line span",
      ".inline-metadata-item",
      "ytd-video-meta-block #metadata-line span"
    ].join(","));
    return [...metadata].some((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      return PAST_STREAM_PATTERNS.some((pattern) => pattern.test(text));
    });
  }

  function streamType(card) {
    if (card.matches(LIVE_MARKER_SELECTOR) || card.querySelector(LIVE_MARKER_SELECTOR)) return "live";
    if (card.matches(UPCOMING_MARKER_SELECTOR) || card.querySelector(UPCOMING_MARKER_SELECTOR)) return "upcoming";
    if (card.matches('[data-nlfyt-stream="past"]') || card.querySelector('[data-nlfyt-stream="past"]')) return "past";
    if (hasBadgeLabel(card, LIVE_LABELS)) return "live";
    if (hasBadgeLabel(card, UPCOMING_LABELS)) return "upcoming";
    if (hasPastStreamLabel(card)) return "past";
    return null;
  }

  function scanCard(card) {
    if (!(card instanceof Element) || !card.matches(CARD_SELECTOR)) return;
    const type = settings.enabled ? streamType(card) : null;
    const hide = type === "live" ||
      (settings.hideUpcoming && type === "upcoming") ||
      (settings.hidePastStreams && type === "past");
    card.classList.toggle("nlfyt-hidden-stream", Boolean(settings.enabled && hide));
  }

  function scanDocument() {
    document.querySelectorAll(CARD_SELECTOR).forEach(scanCard);
    if (!settings.enabled) {
      document.querySelectorAll(".nlfyt-hidden-stream").forEach((card) => {
        card.classList.remove("nlfyt-hidden-stream");
      });
    }
  }

  function queueFullScan() {
    if (fullScanQueued) return;
    fullScanQueued = true;
    requestAnimationFrame(() => {
      fullScanQueued = false;
      scanDocument();
    });
  }

  function addCardsFromNode(node) {
    if (!(node instanceof Element)) return;
    const enclosingCard = node.matches(CARD_SELECTOR) ? node : node.closest(CARD_SELECTOR);
    if (enclosingCard) pendingCards.add(enclosingCard);
    node.querySelectorAll?.(CARD_SELECTOR).forEach((card) => pendingCards.add(card));
  }

  function queueCardScan() {
    if (cardScanQueued) return;
    cardScanQueued = true;
    requestAnimationFrame(() => {
      cardScanQueued = false;
      for (const card of pendingCards) {
        if (card.isConnected) scanCard(card);
      }
      pendingCards.clear();
    });
  }

  function showToast(message) {
    let toast = document.getElementById("nlfyt-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "nlfyt-toast";
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("nlfyt-toast-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("nlfyt-toast-visible"), 2600);
  }

  function navigationLooksAutomatic() {
    const video = document.querySelector("video");
    const nearEnd = Boolean(
      video && Number.isFinite(video.duration) && video.duration > 0 &&
      video.duration - video.currentTime < 4
    );
    return Date.now() < skipChainUntil || (
      Date.now() - lastUserNavigationAt > 5000 &&
      (nearEnd || Date.now() - lastVideoEndedAt < 15000)
    );
  }

  function noteUserNavigation(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('a[href*="/watch"], .ytp-next-button, .ytp-autonav-endscreen-upnext-play-button')) {
      lastUserNavigationAt = Date.now();
    }
  }

  function handlePlayerState(event) {
    const state = event.detail;
    const automatic = Boolean(state?.automaticNavigation || autoplayNavigation || Date.now() < skipChainUntil);
    if (!settings.enabled || !settings.skipAutoplay || !automatic) return;
    if (
      !state?.isLive &&
      !(settings.hideUpcoming && state?.isUpcoming) &&
      !(settings.hidePastStreams && state?.isPastLive)
    ) return;

    const videoId = state.videoId || getVideoId();
    if (!videoId || skippedVideoIds.has(videoId)) return;

    skippedVideoIds.add(videoId);
    skipChainUntil = Date.now() + 20000;
    showToast("Livestream video skipped from autoplay");
    document.dispatchEvent(new CustomEvent("nlfyt:skip-current"));
  }

  function initializeObservers() {
    if (!document.documentElement) {
      setTimeout(initializeObservers, 0);
      return;
    }
    document.documentElement.setAttribute("data-nlfyt-active", "1.3.0");

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        addCardsFromNode(mutation.target);
        mutation.addedNodes.forEach(addCardsFromNode);
      }
      if (pendingCards.size) queueCardScan();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-nlfyt-stream", "overlay-style", "badge-style-type"]
    });
  }

  function ensurePageBridge() {
    setTimeout(() => {
      if (document.documentElement?.hasAttribute("data-nlfyt-bridge")) return;
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("page-bridge.js");
      const pageNonce = document.querySelector("script[nonce]")?.nonce;
      if (pageNonce) script.nonce = pageNonce;
      script.onload = () => script.remove();
      (document.head || document.documentElement)?.appendChild(script);
    }, 500);
  }

  chrome.storage.local.get(DEFAULTS, (saved) => {
    settings = { ...DEFAULTS, ...saved };
    queueFullScan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    queueFullScan();
  });

  document.addEventListener("pointerdown", noteUserNavigation, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") noteUserNavigation(event);
  }, true);
  document.addEventListener("ended", () => {
    lastVideoEndedAt = Date.now();
  }, true);
  document.addEventListener("yt-navigate-start", () => {
    autoplayNavigation = navigationLooksAutomatic();
  });
  document.addEventListener("yt-navigate-finish", queueFullScan);
  document.addEventListener("nlfyt:player-state", handlePlayerState);

  initializeObservers();
  ensurePageBridge();
  setInterval(queueFullScan, 2500);
})();
