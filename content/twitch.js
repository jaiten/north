// North — Twitch content script
// Calm-homepage mode: the front page's carousel and recommendation shelves go,
// replaced by a quiet prompt. Recommended channels leave the side nav too.
// Followed channels, search and direct channel URLs all keep working.

(() => {
  let settings = null;

  // Recommendations are hidden everywhere; Twitch's attributes are more
  // stable than its hashed class names.
  const CLEAN_CSS = `
    .side-nav-section:has([data-a-id^="recommended-channel"]),
    .side-nav-section:has([data-test-selector="recommended-channel"]),
    div[aria-label="Recommended Channels"],
    div[aria-label="Live channels we think you'll like"] {
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
      <div class="north-orb"></div>
      <h2>watch on purpose</h2>
      <p>${(settings?.buddy?.name || "Nori")} cleared the homepage so it can't pick for you.<br>
      your followed channels are in the sidebar. if no one you follow is live, that might be your answer.</p>
      <style>
        #north-twitch-home { position: fixed; inset: 0; z-index: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; pointer-events: none; padding: 0 20px;
          font-family: "Segoe UI", Roboto, sans-serif; color: #efeff1; }
        #north-twitch-home .north-orb { width: 56px; height: 56px; margin-bottom: 20px;
          border-radius: 50%; background: linear-gradient(135deg,#6366f1,#2dd4bf);
          animation: north-breathe 4s ease-in-out infinite; }
        #north-twitch-home h2 { font-size: 22px; font-weight: 600; margin: 0 0 10px; }
        #north-twitch-home p { font-size: 14px; line-height: 1.6; opacity: .75; margin: 0; }
        @keyframes north-breathe { 0%,100% { transform: scale(1); opacity:.85 } 50% { transform: scale(1.12); opacity:1 } }
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
