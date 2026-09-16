// North — YouTube content script
// Hides Shorts everywhere, optionally the home feed / related / comments,
// and hides videos whose title or channel matches blocked keywords.

(() => {
  let settings = null;

  const SHORTS_CSS = `
    ytd-rich-shelf-renderer[is-shorts],
    ytd-reel-shelf-renderer,
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
    grid-shelf-view-model,
    ytm-shorts-lockup-view-model,
    ytd-guide-entry-renderer:has(a#endpoint[title="Shorts"]),
    ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
    yt-chip-cloud-chip-renderer:has(yt-formatted-string[title="Shorts"]),
    a[title="Shorts"][href^="/shorts"],
    ytd-rich-item-renderer:has(a[href^="/shorts"]) {
      display: none !important;
    }`;

  const HOME_FEED_CSS = `
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer #contents,
    ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer {
      display: none !important;
    }`;

  // A softer alternative to hiding the home feed: keep just the first three
  // recommendations, drop the All / Gaming / Music chip bar, and shrink the
  // thumbnails so the page stops shouting. Hiding the continuation sentinel
  // stops infinite scroll from loading a fourth.
  const CALM_HOME_CSS = `
    ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer { display: none !important; }
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer #contents > ytd-rich-item-renderer:nth-of-type(n+4),
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer #contents > ytd-rich-section-renderer,
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer #contents > ytd-continuation-item-renderer {
      display: none !important;
    }
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer {
      --ytd-rich-grid-items-per-row: 5 !important;
    }`;

  const RELATED_CSS = `
    ytd-watch-flexy #secondary ytd-watch-next-secondary-results-renderer,
    ytd-watch-flexy #related,
    /* the wall of "watch next" thumbnails YouTube overlays once a video ends */
    .html5-endscreen,
    .ytp-endscreen-content,
    .ytp-ce-element {
      display: none !important;
    }`;

  const COMMENTS_CSS = `ytd-comments#comments { display: none !important; }`;

  // The whole left rail: expanded guide, mini guide and the hamburger that
  // opens them. The top bar (logo, search, account) stays. History, liked
  // videos and playlists still open by direct URL — on purpose.
  const SIDEBAR_CSS = `
    tp-yt-app-drawer#guide,
    #guide.ytd-app,
    ytd-mini-guide-renderer,
    #guide-button.ytd-masthead,
    ytd-masthead #guide-button {
      display: none !important;
    }
    #page-manager.ytd-app {
      margin-left: 0 !important;
    }`;

  // Sidebar promo destinations: Movies & TV, Music, Live. Matched by title
  // (English UI) and by their stable hrefs as a locale-proof fallback.
  const EXPLORE_CSS = `
    ytd-guide-entry-renderer:has(a#endpoint[title="Movies & TV"]),
    ytd-guide-entry-renderer:has(a#endpoint[title="Movies"]),
    ytd-guide-entry-renderer:has(a#endpoint[title="Music"]),
    ytd-guide-entry-renderer:has(a#endpoint[title="Live"]),
    ytd-guide-entry-renderer:has(a#endpoint[href="/feed/storefront"]),
    ytd-guide-entry-renderer:has(a#endpoint[href^="/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ"]),
    ytd-guide-entry-renderer:has(a#endpoint[href^="/channel/UC4R8DWoMoI7CAwX8_LjQHig"]),
    ytd-guide-entry-renderer:has(a#endpoint[href^="/gaming"]) {
      display: none !important;
    }`;

  const SUBS_CSS = `
    ytd-guide-entry-renderer:has(a[href="/feed/subscriptions"]),
    ytd-mini-guide-entry-renderer:has(a[href="/feed/subscriptions"]),
    ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer #contents,
    ytd-browse[page-subtype="subscriptions"] ytd-section-list-renderer #contents,
    /* the sidebar list of subscribed channels: remember who you came for */
    ytd-guide-section-renderer:has(a#endpoint[href^="/@"]) {
      display: none !important;
    }`;

  function applyStyles() {
    document.getElementById("north-yt-style")?.remove();
    if (!settings?.enabled || window.northPaused?.()) return;
    let css = "";
    if (settings.shorts?.enabled || settings.youtube?.blockShorts) css += SHORTS_CSS;
    if (settings.youtube?.hideHomeFeed) css += HOME_FEED_CSS;
    else if (settings.youtube?.calmHomeFeed) css += CALM_HOME_CSS;
    if (settings.youtube?.hideRelated) css += RELATED_CSS;
    if (settings.youtube?.hideComments) css += COMMENTS_CSS;
    if (settings.youtube?.hideSubscriptions) css += SUBS_CSS;
    if (settings.youtube?.hideSidebar !== false) css += SIDEBAR_CSS;
    else if (settings.youtube?.hideExplore !== false) css += EXPLORE_CSS;
    if (!css) return;
    const style = document.createElement("style");
    style.id = "north-yt-style";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // --- Calm placeholder when the home feed is hidden -----------------------

  function ensureFeedPlaceholder() {
    const isHome = location.pathname === "/" && !location.search &&
      settings?.youtube?.hideHomeFeed;
    const isSubs = location.pathname.startsWith("/feed/subscriptions") &&
      settings?.youtube?.hideSubscriptions;
    if (!settings?.enabled || window.northPaused?.() || (!isHome && !isSubs)) {
      document.getElementById("north-yt-placeholder")?.remove();
      return;
    }
    const grid = document.querySelector(
      'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,' +
      'ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer,' +
      'ytd-browse[page-subtype="subscriptions"] ytd-section-list-renderer');
    if (!grid || document.getElementById("north-yt-placeholder")) return;
    const card = document.createElement("div");
    card.id = "north-yt-placeholder";
    card.innerHTML = `
      <div class="north-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 19 20.5 12 17 5 20.5Z"/></svg></div>
      <h2>Search with intention</h2>
      <p>North hid the feed so it can't choose for you.<br>
      If you came here for something specific, search for it. If not, something better is probably waiting.</p>`;
    const style = document.createElement("style");
    style.textContent = `
      #north-yt-placeholder { max-width: 460px; margin: 12vh auto; text-align: center;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--yt-spec-text-primary, #f1f1f1); }
      #north-yt-placeholder .north-mark { width: 56px; height: 56px; margin: 0 auto 20px;
        display: grid; place-items: center; font-size: 24px; color: #fff;
        border-radius: 16px; background: linear-gradient(150deg,#4e8c6a,#356b52 52%,#24503c); }
      #north-yt-placeholder .north-mark svg { width: 54%; height: 54%; fill: #fff; }
      #north-yt-placeholder h2 { font-size: 22px; font-weight: 600; margin: 0 0 10px; }
      #north-yt-placeholder p { font-size: 14px; line-height: 1.6; opacity: .75; margin: 0; }`;
    card.appendChild(style);
    grid.parentElement.insertBefore(card, grid);
  }

  // --- Keyword filtering of video renderers --------------------------------

  function keywordList() {
    const a = settings?.keywords || [];
    const b = settings?.youtube?.titleKeywords || [];
    return [...a, ...b].map(k => k.toLowerCase()).filter(Boolean);
  }

  const RENDERERS = [
    "ytd-rich-item-renderer", "ytd-video-renderer", "ytd-compact-video-renderer",
    "ytd-grid-video-renderer", "ytd-playlist-renderer", "ytd-radio-renderer"
  ].join(",");

  function filterVideos() {
    if (!settings?.enabled || window.northPaused?.()) return;
    const blockKws = keywordList();
    const topicMode = settings.youtube?.topicMode &&
      (settings.youtube?.allowedKeywords || []).length > 0;
    const allowKws = (settings.youtube?.allowedKeywords || []).map(k => k.toLowerCase());
    if (!blockKws.length && !topicMode) return;

    for (const el of document.querySelectorAll(`${RENDERERS}:not([data-north-checked])`)) {
      el.setAttribute("data-north-checked", "1");
      const title = el.querySelector("#video-title")?.textContent || "";
      const channel = el.querySelector("ytd-channel-name, #channel-name")?.textContent || "";
      const text = (title + " " + channel).toLowerCase();
      if (!text.trim()) continue;
      const blocked = blockKws.some(k => text.includes(k));
      // Topic mode: in feeds and search, only videos matching your topics survive.
      const offTopic = topicMode && !allowKws.some(k => text.includes(k));
      if (blocked || offTopic) el.style.setProperty("display", "none", "important");
    }
  }

  // --- Wiring ----------------------------------------------------------------

  let scheduled = false;
  function onMutate() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      filterVideos();
      ensureFeedPlaceholder();
    }, 250);
  }

  function boot() {
    applyStyles();
    const obs = new MutationObserver(onMutate);
    const start = () => {
      if (!document.body) return requestAnimationFrame(start);
      obs.observe(document.body, { childList: true, subtree: true });
      onMutate();
    };
    start();
    // YouTube SPA navigation
    window.addEventListener("yt-navigate-finish", () => {
      // re-check unfiltered renderers after navigation re-renders
      document.querySelectorAll("[data-north-checked]").forEach(el => el.removeAttribute("data-north-checked"));
      onMutate();
    });

    // A back/forward-cache restore can resurrect a page that should be
    // blocked. A fresh load puts it back through the rules.
    window.addEventListener("pageshow", e => { if (e.persisted) location.reload(); });

    // Report playback position so a mid-video block can resume, not restart.
    setInterval(() => {
      if (location.pathname !== "/watch") return;
      const video = document.querySelector("video.html5-main-video, video");
      const vid = new URLSearchParams(location.search).get("v");
      if (video && vid && video.currentTime > 10) {
        chrome.runtime.sendMessage({ type: "ytTime", videoId: vid, t: video.currentTime }).catch(() => {});
      }
    }, 5000);
  }

  chrome.storage.local.get("settings", ({ settings: s }) => {
    settings = s || {};
    boot();
  });
  // Re-style and re-judge every video card that was already on the page.
  function refresh() {
    applyStyles();
    document.querySelectorAll("[data-north-checked]").forEach(el => {
      el.removeAttribute("data-north-checked");
      el.style.removeProperty("display");
    });
    onMutate();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = changes.settings.newValue || {};
      refresh();
    }
  });
  // A pause takes the hiding with it, and the minute puts it back.
  window.northOnPauseChange?.(refresh);
})();
