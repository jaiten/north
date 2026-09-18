// North — news outlet content script
// Strips the noise around an article — recommended/trending/most-read rails,
// "more from", recirculation widgets, Taboola/Outbrain chum boxes and
// newsletter pop-ups — so you read the thing you came for and leave.
// Only runs on a curated list of news hosts (see manifest), and only when the
// "calm news outlets" setting is on.

(() => {
  let settings = null;

  // Universal third-party recommendation widgets and the homegrown rails news
  // sites bolt onto every article. Scoped to news hosts (via the manifest), so
  // matching on generic class/id fragments is safe enough to be worth it.
  const NOISE_CSS = `
    /* third-party chum boxes — same everywhere */
    [id*="taboola" i], [class*="taboola" i],
    [id*="outbrain" i], [class*="outbrain" i], [class*="OUTBRAIN" i],
    [id*="zergnet" i], [class*="zergnet" i],
    .ob-widget, .trc_related_container, [data-widget-id*="taboola" i],

    /* homegrown recirculation / recommendation rails */
    [class*="recirc" i], [class*="recommend" i], [class*="related-" i],
    [class*="-related" i], [data-testid*="related" i],
    [class*="more-from" i], [class*="morefrom" i], [class*="read-more" i],
    [class*="most-read" i], [class*="most-popular" i], [class*="mostpopular" i],
    [class*="trending" i], [data-testid*="trending" i],
    [class*="popular" i][class*="stories" i],
    [aria-label*="recommend" i], [aria-label*="related" i],
    [aria-label*="more" i][aria-label*="stories" i],
    section[data-component*="recommend" i],
    section[data-component*="related" i],

    /* newsletter / subscribe interrupts */
    [class*="newsletter" i], [class*="signup" i][class*="email" i],
    [class*="subscribe-prompt" i], [class*="piano-" i] {
      display: none !important;
    }`;

  // A few outlets need a targeted nudge: their rails don't carry an obvious
  // class, or they sit in a named slot. Kept short and host-keyed.
  const SITE_CSS = {
    "nytimes.com": `
      section[aria-label*="More in" i],
      section.story-meta ~ section[aria-label] { display:none !important; }`,
    "theguardian.com": `
      aside#related-content, [data-link-name*="related" i],
      gu-island[name*="Most" i], div[data-component="most-popular"] { display:none !important; }`,
    "bbc.com": `
      [data-component="topic-list"], [data-component="links-block"],
      section[data-analytics-group="most-read"], div[data-testid="topic-promos"] { display:none !important; }`,
    "cnn.com": `
      div.related-content, section[data-zone-label*="more" i],
      div[data-uri*="zone" i]:has(div.cn-list-hierarchical-xs) { display:none !important; }`
  };

  function rootHost() {
    const h = location.hostname.replace(/^www\.|^m\.|^amp\./, "");
    return h;
  }

  function siteCssFor(host) {
    for (const [domain, css] of Object.entries(SITE_CSS)) {
      if (host === domain || host.endsWith("." + domain)) return css;
    }
    return "";
  }

  function applyStyles() {
    document.getElementById("north-news-style")?.remove();
    if (!settings?.enabled || window.northPaused?.() || !settings?.news?.declutter) return;
    const css = NOISE_CSS + siteCssFor(rootHost());
    const style = document.createElement("style");
    style.id = "north-news-style";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // The honest moment for this one is the moment you scroll past the end of
  // the article into what the page lines up next. If an outlet has no such
  // rail, there's nothing to offer and no card.
  const CHUM_SELECTOR = [
    '[id*="taboola" i]', '[class*="taboola" i]', '[class*="outbrain" i]',
    '[class*="recirc" i]', '[class*="most-read" i]', '[class*="most-popular" i]',
    '[data-component="most-popular"]'
  ].join(",");

  function armHints() {
    // Section fronts and homepages aren't articles; a story URL has a path.
    if (!window.northHint || location.pathname.split("/").filter(Boolean).length < 2) return;
    window.northHint.whenSeen("news-quiet", CHUM_SELECTOR, 2);
  }

  chrome.storage.local.get("settings", ({ settings: s }) => {
    settings = s || {};
    applyStyles();
    armHints();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = changes.settings.newValue || {};
      applyStyles();
    }
  });
  // A pause takes the decluttering with it, and the minute puts it back.
  window.northOnPauseChange?.(applyStyles);
})();
