// North — Instagram content script
// In DM-only mode, navigation is enforced by the background worker; this
// script removes the temptation surface: every nav item except Messages.

(() => {
  let settings = null;

  const DM_ONLY_CSS = `
    /* Hide all primary nav links except Direct messages and the profile/menu */
    a[href="/"]:not([aria-label*="Direct"]),
    a[href^="/explore"],
    a[href^="/reels"],
    svg[aria-label="Home"], svg[aria-label="Search"], svg[aria-label="Explore"],
    svg[aria-label="Reels"], svg[aria-label="Notifications"],
    a[href^="/p/"], a[href*="/create/"] {
      display: none !important;
    }
    /* Hide parent nav wrappers of hidden icons */
    div:has(> a > div > div > svg[aria-label="Home"]),
    div:has(> a > div > div > svg[aria-label="Search"]),
    div:has(> a > div > div > svg[aria-label="Explore"]),
    div:has(> a > div > div > svg[aria-label="Reels"]),
    div:has(> a > div > div > svg[aria-label="Notifications"]),
    span:has(> div > a > div > svg[aria-label="Notifications"]) {
      display: none !important;
    }`;

  const REELS_ONLY_CSS = `
    a[href^="/reels"], svg[aria-label="Reels"],
    div:has(> a > div > div > svg[aria-label="Reels"]) {
      display: none !important;
    }`;

  function apply() {
    document.getElementById("north-ig-style")?.remove();
    if (!settings?.enabled || window.northPaused?.()) return;
    let css = "";
    if (settings.messagesOnly?.instagram) css += DM_ONLY_CSS;
    else if (settings.shorts?.enabled) css += REELS_ONLY_CSS;
    if (!css) return;
    const style = document.createElement("style");
    style.id = "north-ig-style";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // The "press back twice" loophole: Chrome can restore this page from the
  // back/forward cache with a reel modal still open while the URL reads as an
  // allowed /direct path. A fresh load kills the stale modal and puts the
  // current URL back through the rules.
  window.addEventListener("pageshow", e => { if (e.persisted) location.reload(); });

  // The feed, sat with for a while, is the moment to mention that Instagram
  // has a messages-only mode. The card points at settings rather than
  // switching it on: it's a protection with a challenge behind it.
  function armHints() {
    if (!window.northHint) return;
    const onFeed = () => location.pathname === "/" || location.pathname === "/explore/";
    if (onFeed()) window.northHint.afterDwell("ig-messages", 12, onFeed);
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
  // A pause takes the nav stripping with it, and the minute puts it back.
  window.northOnPauseChange?.(apply);
})();
