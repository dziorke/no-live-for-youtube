(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    hideUpcoming: true,
    hidePastStreams: true,
    skipAutoplay: true
  };

  const ids = Object.keys(DEFAULTS);
  const extraSettings = document.getElementById("extra-settings");
  const savedMessage = document.getElementById("saved");
  let savedTimer;

  function reflectEnabledState() {
    extraSettings.classList.toggle("disabled", !document.getElementById("enabled").checked);
  }

  function saveSetting(event) {
    const input = event.currentTarget;
    chrome.storage.local.set({ [input.id]: input.checked });
    reflectEnabledState();

    savedMessage.classList.add("visible");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => savedMessage.classList.remove("visible"), 1000);
  }

  chrome.storage.local.get(DEFAULTS, (settings) => {
    for (const id of ids) {
      const input = document.getElementById(id);
      input.checked = settings[id];
      input.addEventListener("change", saveSetting);
    }
    reflectEnabledState();
  });
})();
