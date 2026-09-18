// North — LinkedIn content script
// Tidy-nav mode hides the two navbar buttons that lead to the feed: Home and
// My Network. Messaging, jobs and notifications stay where they were. The
// heavier messages-only mode is enforced by the background worker; this is
// the lighter, no-challenge cleanup.

(() => {
  let settings = null;

  const TIDY_NAV_CSS = `
    li.global-nav__primary-item:has(a[href*="/feed/"]),
    li.global-nav__primary-item:has(a[href*="/mynetwork/"]),
    li.global-nav__primary-item:has(a[data-test-global-nav-link="home"]),
    li.global-nav__primary-item:has(a[data-test-global-nav-link="mynetwork"]) {
      display: none !important;
    }`;

  function apply() {
    document.getElementById("north-li-style")?.remove();
    if (!settings?.enabled || window.northPaused?.()) return;
    if (settings.linkedin?.tidyNav === false) return;
    const style = document.createElement("style");
    style.id = "north-li-style";
    style.textContent = TIDY_NAV_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // Same idea as Instagram: name the feed while someone is scrolling it, and
  // send them to settings, where messages-only mode explains its own cost.
  function armHints() {
    if (!window.northHint) return;
    const onFeed = () => location.pathname === "/feed/" || location.pathname === "/";
    if (onFeed()) window.northHint.afterDwell("li-messages", 12, onFeed);
  }

  chrome.storage.local.get("settings", ({ settings: s }) => {
    settings = s || {};
    apply();
    armHints();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = changes.settings.newValue || {};
      apply();
    }
  });
  // A pause takes the decluttering with it, and the minute puts it back.
  window.northOnPauseChange?.(apply);
})();
