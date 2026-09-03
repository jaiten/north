// North — Twitch content script
// Calm mode: the front page's carousel and recommendation shelves go, replaced
// by a quiet prompt. Recommended channels and categories leave the side nav,
// and the top bar loses Following, Browse and the notification bell. Followed
// channels in the sidebar, search and direct channel URLs all keep working.

(() => {
  let settings = null;

  // Recommendations and nav bait are hidden everywhere; Twitch's data
  // attributes are more stable than its hashed class names.
  const CLEAN_CSS = `
    /* sidebar: recommended channels + recommended categories + For You header */
    .side-nav-section:has([data-a-id^="recommended-channel"]),
    .side-nav-section:has([data-test-selector="recommended-channel"]),
    .side-nav-section:has(a[href^="/directory/category"]),
    div[aria-label="Recommended Channels"],
    div[aria-label="Recommended Categories"],
    div[aria-label="Live channels we think you'll like"],
    #side-nav .side-nav-header,
    [data-a-target="side-nav-header-expanded"],
    /* top bar: Following, Browse, the dots menu next to them, notifications */
    [data-a-target="following-link"],
    a[href="/directory/following"],
    [data-a-target="browse-link"],
    a[href="/directory"],
    [data-a-target="top-nav-get-bits-button"],
    .onsite-notifications,
    button[data-a-target="onsite-notifications-toggle"],
    div:has(> button[data-a-target="onsite-notifications-toggle"]) {
      display: none !important;
    }`;

  // On the front page itself, everything in <main> goes quiet.
  const HOME_CSS = `
    main { visibility: hidden !important; }
    #north-twitch-home { visibility: visible; }`;

  const onHome = () => location.pathname === "/" || location.pathname === "";

  function placeholder() {
    let card = document.getElementById("north-twitch-home");
    if (card) return card;
    card = document.createElement("div");
    card.id = "north-twitch-home";
    card.innerHTML = `
      <div class="north-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 19 20.5 12 17 5 20.5Z"/></svg></div>
      <h2>Watch on purpose</h2>
      <p>North cleared the homepage so it can't choose for you.<br>
      Your followed channels are in the sidebar. If nobody you follow is live, that may be your answer.</p>
      <style>
        #north-twitch-home { position: fixed; inset: 0; z-index: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; pointer-events: none; padding: 0 20px;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #efeff1; }
        #north-twitch-home .north-mark { width: 56px; height: 56px; margin-bottom: 20px;
          display: grid; place-items: center; font-size: 24px; color: #fff;
          border-radius: 16px; background: linear-gradient(135deg,#5b6ef5,#2dd4bf); }
        #north-twitch-home .north-mark svg { width: 54%; height: 54%; fill: #fff; }
        #north-twitch-home h2 { font-size: 22px; font-weight: 600; margin: 0 0 10px; }
        #north-twitch-home p { font-size: 14px; line-height: 1.6; opacity: .75; margin: 0; }
      </style>`;
    document.body.appendChild(card);
    return card;
  }

  function apply() {
    document.getElementById("north-tw-style")?.remove();
    document.getElementById("north-tw-home-style")?.remove();
    const active = settings?.enabled && settings.twitch?.cleanHome !== false;
    if (!active) {
      document.getElementById("north-twitch-home")?.remove();
      return;
    }
    const style = document.createElement("style");
    style.id = "north-tw-style";
    style.textContent = CLEAN_CSS;
    (document.head || document.documentElement).appendChild(style);

    if (onHome()) {
      const home = document.createElement("style");
      home.id = "north-tw-home-style";
      home.textContent = HOME_CSS;
      document.head.appendChild(home);
      if (document.body) placeholder();
    } else {
      document.getElementById("north-twitch-home")?.remove();
    }
  }

  // Twitch is a SPA; watch for soft navigations.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      apply();
    }
  }, 400);

  const boot = () => {
    if (!document.body) return requestAnimationFrame(boot);
    apply();
  };

  chrome.storage.local.get("settings", ({ settings: s }) => {
    settings = s || {};
    boot();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = changes.settings.newValue || {};
      apply();
    }
  });
})();
