// North — pause state, shared by the site content scripts.
//
// The one-minute pause turns North off, and "off" has to mean the decluttering
// too: a paused North that still hides YouTube's sidebar isn't off, it's
// confusing. This runs before each site script and hands it two things —
// northPaused(), and a callback for when that answer changes, including the
// moment the minute runs out.
(() => {
  let until = 0;
  let timer = null;
  const subscribers = new Set();

  function notify() {
    for (const fn of subscribers) {
      try { fn(); } catch { /* one bad listener shouldn't stop the rest */ }
    }
  }

  function set(pause) {
    until = pause?.until || 0;
    clearTimeout(timer);
    if (until > Date.now()) {
      // Re-apply the moment it lapses, without waiting for a navigation.
      timer = setTimeout(() => { until = 0; notify(); }, until - Date.now() + 250);
    }
    notify();
  }

  try {
    chrome.storage.local.get("pause", ({ pause }) => set(pause));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.pause) set(changes.pause.newValue);
    });
  } catch { /* storage unavailable: treat as not paused */ }

  window.northPaused = () => until > Date.now();
  window.northOnPauseChange = fn => subscribers.add(fn);
})();
