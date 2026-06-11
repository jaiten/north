// North — Focus Companion
// Background service worker: rules engine, time tracking, schedules, unlocks.

// ---------------------------------------------------------------------------
// Defaults & storage
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  enabled: true,
  strict: {
    enabled: true,
    waitSeconds: 60,          // how long you must wait before the challenge
    challenge: "phrase",      // "phrase" | "math" | "both"
    maxUnlockMinutes: 15
  },
  buddy: {
    enabled: true,
    name: "Nori",
    tone: "kind"              // "kind" | "tough"
  },
  shorts: {
    enabled: true,            // block ALL short-form content everywhere
    blockTikTokEntirely: true,
    allowSharedLinks: true    // a single reel/short opened from outside the platform plays
  },
  instagramDmOnly: true,      // only instagram.com/direct/* is reachable
  adultBlock: true,           // category block, never unlockable
  keywords: [],               // blocked keywords (URL + page title)
  youtube: {
    blockShorts: true,
    hideHomeFeed: false,
    hideRelated: false,
    hideComments: false,
    hideSubscriptions: false,
    titleKeywords: []         // hide videos whose title/channel matches
  },
  betterPlaces: [
    { label: "Learn something on Khan Academy", url: "https://www.khanacademy.org" },
    { label: "A random Wikipedia article", url: "https://en.wikipedia.org/wiki/Special:Random" },
    { label: "Practice coding on freeCodeCamp", url: "https://www.freecodecamp.org/learn" },
    { label: "Read a classic on Project Gutenberg", url: "https://www.gutenberg.org/ebooks/search/?sort_order=downloads" },
    { label: "Pick up a language on Duolingo", url: "https://www.duolingo.com" }
  ],
  sites: [
    // { id, pattern, mode: "always"|"schedule"|"limit",
    //   schedule: [{days:[0..6], start:"09:00", end:"17:00"}],
    //   limitMins: 30 }
    { id: "s_x",   pattern: "x.com",        mode: "always", schedule: [], limitMins: 0 },
    { id: "s_tw",  pattern: "twitter.com",  mode: "always", schedule: [], limitMins: 0 },
    { id: "s_fb",  pattern: "facebook.com", mode: "always", schedule: [], limitMins: 0 },
    { id: "s_rd",  pattern: "reddit.com",   mode: "limit",  schedule: [], limitMins: 20 }
  ]
};

let cache = { settings: null, unlocks: {}, focus: null };

async function getSettings() {
  if (cache.settings) return cache.settings;
  const { settings } = await chrome.storage.local.get("settings");
  cache.settings = deepMerge(structuredClone(DEFAULT_SETTINGS), settings || {});
  return cache.settings;
}

async function saveSettings(settings) {
  cache.settings = settings;
  await chrome.storage.local.set({ settings });
}

function deepMerge(base, extra) {
  for (const k of Object.keys(extra || {})) {
    if (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) &&
        base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      deepMerge(base[k], extra[k]);
    } else {
      base[k] = extra[k];
    }
  }
  return base;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.settings) cache.settings = null;
  if (changes.unlocks) cache.unlocks = changes.unlocks.newValue || {};
  if (changes.focus) cache.focus = changes.focus.newValue || null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function domainMatches(host, pattern) {
  pattern = pattern.replace(/^www\./, "").toLowerCase();
  host = host.toLowerCase();
  return host === pattern || host.endsWith("." + pattern);
}

function minutesNow(d = new Date()) { return d.getHours() * 60 + d.getMinutes(); }

function parseHM(s) {
  const [h, m] = (s || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function inSchedule(scheduleList, d = new Date()) {
  if (!scheduleList || !scheduleList.length) return false;
  const day = d.getDay();
  const now = minutesNow(d);
  return scheduleList.some(w => {
    if (!w.days || !w.days.includes(day)) return false;
    const start = parseHM(w.start), end = parseHM(w.end);
    if (start <= end) return now >= start && now < end;
    return now >= start || now < end; // overnight window, e.g. 22:00–06:00
  });
}

// ---------------------------------------------------------------------------
// Short-form content detection
// ---------------------------------------------------------------------------

function isShortForm(url, settings) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const path = u.pathname.toLowerCase();

  if (host.endsWith("youtube.com") && path.startsWith("/shorts")) return true;
  if (host.endsWith("instagram.com") && (path.startsWith("/reels") || path.startsWith("/reel/"))) return true;
  if (host.endsWith("facebook.com") && (path.startsWith("/reel") || path.startsWith("/watch/reels"))) return true;
  if (host.endsWith("snapchat.com") && path.startsWith("/spotlight")) return true;
  if (host.endsWith("tiktok.com") && settings.shorts.blockTikTokEntirely) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Adult content (category block — never unlockable)
// ---------------------------------------------------------------------------

const ADULT_DOMAINS = [
  "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com",
  "youporn.com", "spankbang.com", "eporner.com", "rule34.xxx", "onlyfans.com",
  "fansly.com", "chaturbate.com", "stripchat.com", "bongacams.com",
  "livejasmin.com", "myfreecams.com", "cam4.com", "motherless.com",
  "tnaflix.com", "hclips.com", "beeg.com", "porntrex.com", "hqporner.com",
  "youjizz.com", "brazzers.com", "adulttime.com", "nhentai.net",
  "e-hentai.org", "hanime.tv", "f95zone.to", "literotica.com", "fapello.com"
];

const ADULT_KEYWORDS = [
  "porn", "hentai", " xxx", "xxx ", "nsfw", "onlyfans", "camgirl",
  "blowjob", "milf", "xvideos", "xhamster", "stripchat", "chaturbate"
];

function isAdult(url, title = "") {
  const host = hostnameOf(url);
  if (ADULT_DOMAINS.some(d => domainMatches(host, d))) return true;
  let hay;
  try { hay = decodeURIComponent(url).toLowerCase(); } catch { hay = url.toLowerCase(); }
  hay += " " + title.toLowerCase();
  return ADULT_KEYWORDS.some(k => hay.includes(k));
}

// ---------------------------------------------------------------------------
// Shared-link pass: a friend sends you one reel/short — that one item plays.
// Granted when a short-form item is opened from OUTSIDE the platform (a DM,
// another app, a pasted link). Locked to that exact item id and tab; swiping
// to the next item is blocked.
// ---------------------------------------------------------------------------

const tabNav = new Map(); // tabId -> { lastUrl, pass: { id, until } }

function shortFormItem(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let m;
  if (host.endsWith("youtube.com") && (m = u.pathname.match(/^\/shorts\/([\w-]+)/))) {
    return { platform: "yt", id: m[1] };
  }
  if (host.endsWith("instagram.com") && (m = u.pathname.match(/^\/reels?\/([\w-]+)/))) {
    return { platform: "ig", id: m[1] };
  }
  if (host.endsWith("facebook.com") && (m = u.pathname.match(/^\/reel\/([\w-]+)/))) {
    return { platform: "fb", id: m[1] };
  }
  return null;
}

function rootDomain(host) { return host.split(".").slice(-2).join("."); }

function sharePassAllows(tabId, url, settings) {
  if (!settings.shorts.allowSharedLinks || tabId == null) return false;
  const item = shortFormItem(url);
  if (!item) return false;

  const nav = tabNav.get(tabId) || {};
  if (nav.pass && nav.pass.id === item.id && nav.pass.until > Date.now()) return true;

  // Decide whether this navigation came from outside the platform.
  let external = false;
  const prev = nav.lastUrl;
  if (!prev) {
    external = true; // fresh tab — opened from another app or a link click
  } else {
    try {
      const prevU = new URL(prev);
      const prevHost = prevU.hostname.replace(/^www\./, "");
      const curHost = new URL(url).hostname.replace(/^www\./, "");
      if (rootDomain(prevHost) !== rootDomain(curHost)) external = true;
      // Instagram DMs are a legitimate in-platform source for shared reels.
      if (item.platform === "ig" && prevU.pathname.startsWith("/direct")) external = true;
    } catch { /* ignore */ }
  }
  if (!external) return false;

  nav.pass = { id: item.id, until: Date.now() + 10 * 60e3 };
  tabNav.set(tabId, nav);
  return true;
}

// ---------------------------------------------------------------------------
// Instagram DM-only
// ---------------------------------------------------------------------------

const IG_ALLOWED_PREFIXES = [
  "/direct", "/accounts", "/api", "/login", "/logout",
  "/challenge", "/two_factor", "/static", "/graphql", "/ajax", "/legal"
];

function instagramVerdict(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!u.hostname.replace(/^www\./, "").endsWith("instagram.com")) return null;
  const path = u.pathname;
  if (path === "/" || path === "") return { redirect: "https://www.instagram.com/direct/inbox/" };
  if (IG_ALLOWED_PREFIXES.some(p => path.startsWith(p))) return null; // allowed
  return { block: true };
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

async function getUsageSecondsToday(domainPattern) {
  const key = dateKey();
  const { usage = {} } = await chrome.storage.local.get("usage");
  const today = usage[key] || {};
  let total = 0;
  for (const [host, secs] of Object.entries(today)) {
    if (domainMatches(host, domainPattern)) total += secs;
  }
  return total;
}

async function getUnlocks() {
  if (!cache.unlocks || !Object.keys(cache.unlocks).length) {
    const { unlocks = {} } = await chrome.storage.local.get("unlocks");
    cache.unlocks = unlocks;
  }
  return cache.unlocks;
}

async function getFocus() {
  if (cache.focus === null) {
    const { focus = { active: false } } = await chrome.storage.local.get("focus");
    cache.focus = focus;
  }
  if (cache.focus?.active && cache.focus.until < Date.now()) {
    await completeFocus();
  }
  return cache.focus || { active: false };
}

/**
 * Decide what to do with a URL.
 * @returns {null | {reason, site?, redirect?, detail?}}
 */
async function evaluate(url, { title = "", tabId = null } = {}) {
  if (!/^https?:/i.test(url)) return null;
  const settings = await getSettings();
  if (!settings.enabled) return null;

  const host = hostnameOf(url);
  if (!host) return null;

  // 0. Adult content — never unlockable.
  if (settings.adultBlock && isAdult(url, title)) {
    return { reason: "adult", site: host };
  }

  const focus = await getFocus();
  const unlocks = await getUnlocks();
  const unlockedUntil = Object.entries(unlocks)
    .find(([d, until]) => domainMatches(host, d) && until > Date.now());
  const isUnlocked = !!unlockedUntil && !focus.active; // unlocks don't apply during focus

  // A single shared reel/short opened from outside the platform may pass the
  // short-form and DM-only checks — but NOT site rules, keywords or focus.
  const shared = !focus.active && sharePassAllows(tabId, url, settings);

  // 1. Short-form content — never unlockable, by design.
  if (settings.shorts.enabled && !shared && isShortForm(url, settings)) {
    return { reason: "shorts", site: host };
  }

  // 2. Instagram DM-only.
  if (settings.instagramDmOnly && !isUnlocked && !shared) {
    const v = instagramVerdict(url);
    if (v?.redirect) return { reason: "ig-redirect", redirect: v.redirect };
    if (v?.block) return { reason: "instagram", site: "instagram.com" };
  }

  // 3. Keyword blocking (URL + title).
  const haystack = decodeURIComponent(url).toLowerCase() + " " + (title || "").toLowerCase();
  const kw = (settings.keywords || []).find(k => k && haystack.includes(k.toLowerCase()));
  if (kw && !isUnlocked) return { reason: "keyword", site: host, detail: kw };

  // 4. Site rules.
  for (const site of settings.sites || []) {
    if (!domainMatches(host, site.pattern)) continue;

    if (focus.active) return { reason: "focus", site: site.pattern };
    if (isUnlocked) return null;

    if (site.mode === "always") return { reason: "blocklist", site: site.pattern };

    if (site.mode === "schedule" && inSchedule(site.schedule)) {
      return { reason: "schedule", site: site.pattern };
    }

    if (site.mode === "limit" && site.limitMins > 0) {
      const used = await getUsageSecondsToday(site.pattern);
      if (used >= site.limitMins * 60) {
        return { reason: "limit", site: site.pattern, detail: String(site.limitMins) };
      }
    }
  }

  return null;
}

function blockedPageUrl(verdict, fromUrl) {
  const p = new URLSearchParams({
    reason: verdict.reason,
    site: verdict.site || "",
    detail: verdict.detail || "",
    from: fromUrl
  });
  return chrome.runtime.getURL("pages/blocked.html") + "?" + p.toString();
}

// One navigation fires several webNavigation/tabs events; dedupe so a single
// blocked visit is redirected and counted once.
const recentBlocks = new Map(); // tabId -> { url, ts }

async function enforceOnTab(tabId, url, title = "") {
  const verdict = await evaluate(url, { title, tabId });
  if (!verdict) {
    // Allowed — remember where this tab is, so the shared-link pass can tell
    // "came from a DM / another app" apart from "browsing within the platform".
    const nav = tabNav.get(tabId) || {};
    nav.lastUrl = url;
    tabNav.set(tabId, nav);
    return false;
  }
  const last = recentBlocks.get(tabId);
  if (last && last.url === url && Date.now() - last.ts < 3000) return true;
  recentBlocks.set(tabId, { url, ts: Date.now() });
  const target = verdict.redirect || blockedPageUrl(verdict, url);
  if (!verdict.redirect) await recordBlock(verdict.site || hostnameOf(url));
  try { await chrome.tabs.update(tabId, { url: target }); } catch { /* tab gone */ }
  return true;
}

chrome.tabs.onRemoved.addListener(tabId => {
  recentBlocks.delete(tabId);
  tabNav.delete(tabId);
});

// ---------------------------------------------------------------------------
// Navigation hooks (covers SPAs like YouTube/Instagram via history updates)
// ---------------------------------------------------------------------------

chrome.webNavigation.onBeforeNavigate.addListener(d => {
  if (d.frameId !== 0) return;
  enforceOnTab(d.tabId, d.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener(d => {
  if (d.frameId !== 0) return;
  enforceOnTab(d.tabId, d.url);
});

chrome.webNavigation.onCommitted.addListener(d => {
  if (d.frameId !== 0) return;
  enforceOnTab(d.tabId, d.url);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url) enforceOnTab(tabId, info.url);
  if (info.status === "complete" && tab?.url) trackSwitch(tab.url);
});

// ---------------------------------------------------------------------------
// Time tracking (active focused tab only)
// ---------------------------------------------------------------------------

let tracking = { host: null, since: null };

async function flushTracking() {
  if (!tracking.host || !tracking.since) return;
  const secs = Math.round((Date.now() - tracking.since) / 1000);
  tracking.since = Date.now();
  if (secs <= 0 || secs > 6 * 3600) return; // sanity guard
  const key = dateKey();
  const { usage = {} } = await chrome.storage.local.get("usage");
  usage[key] = usage[key] || {};
  usage[key][tracking.host] = (usage[key][tracking.host] || 0) + secs;
  await chrome.storage.local.set({ usage });
}

async function trackSwitch(url) {
  await flushTracking();
  const host = url && /^https?:/.test(url) ? hostnameOf(url) : null;
  tracking = host ? { host, since: Date.now() } : { host: null, since: null };
}

async function refreshActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await trackSwitch(tab?.url || null);
  } catch { /* no window */ }
}

chrome.tabs.onActivated.addListener(refreshActiveTab);
chrome.windows.onFocusChanged.addListener(winId => {
  if (winId === chrome.windows.WINDOW_ID_NONE) trackSwitch(null);
  else refreshActiveTab();
});
chrome.idle.setDetectionInterval(120);
chrome.idle.onStateChanged.addListener(state => {
  if (state === "active") refreshActiveTab();
  else trackSwitch(null);
});

// ---------------------------------------------------------------------------
// Alarms: minute tick (limit enforcement + nudges), midnight cleanup
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async details => {
  chrome.alarms.create("tick", { periodInMinutes: 1 });
  await getSettings().then(saveSettings); // persist merged defaults
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/options.html") + "#welcome" });
  }
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("tick", { periodInMinutes: 1 }));

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === "tick") {
    await flushTracking();
    await enforceLimitsOnActiveTab();
    await pruneOldData();
  }
  if (alarm.name === "focus-end") await completeFocus();
});

async function enforceLimitsOnActiveTab() {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); } catch { return; }
  if (!tab?.url || !/^https?:/.test(tab.url)) return;

  const blocked = await enforceOnTab(tab.id, tab.url);
  if (blocked) return;

  // Nudge when a limited site is nearly out of time.
  const settings = await getSettings();
  const host = hostnameOf(tab.url);
  for (const site of settings.sites || []) {
    if (site.mode !== "limit" || !site.limitMins || !domainMatches(host, site.pattern)) continue;
    const used = await getUsageSecondsToday(site.pattern);
    const leftMin = Math.ceil((site.limitMins * 60 - used) / 60);
    if (leftMin > 0 && leftMin <= 5 && settings.buddy.enabled) {
      sendNudge(tab.id, `${leftMin} minute${leftMin === 1 ? "" : "s"} left on ${site.pattern} today. Make it count, then come back to what matters.`);
    }
  }
}

function sendNudge(tabId, text) {
  chrome.tabs.sendMessage(tabId, { type: "north-nudge", text }).catch(() => {});
}

async function pruneOldData() {
  const cutoff = new Date(Date.now() - 30 * 86400e3);
  const { usage = {}, stats = {} } = await chrome.storage.local.get(["usage", "stats"]);
  let dirty = false;
  for (const store of [usage, stats]) {
    for (const k of Object.keys(store)) {
      if (new Date(k) < cutoff) { delete store[k]; dirty = true; }
    }
  }
  // expire dead unlocks
  const unlocks = await getUnlocks();
  for (const [d, until] of Object.entries(unlocks)) {
    if (until < Date.now()) { delete unlocks[d]; dirty = true; }
  }
  if (dirty) await chrome.storage.local.set({ usage, stats, unlocks });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function recordBlock(domain) {
  const key = dateKey();
  const { stats = {} } = await chrome.storage.local.get("stats");
  stats[key] = stats[key] || { blocks: {}, focusMinutes: 0, unlocks: 0 };
  stats[key].blocks[domain] = (stats[key].blocks[domain] || 0) + 1;
  await chrome.storage.local.set({ stats });
}

async function recordUnlock() {
  const key = dateKey();
  const { stats = {} } = await chrome.storage.local.get("stats");
  stats[key] = stats[key] || { blocks: {}, focusMinutes: 0, unlocks: 0 };
  stats[key].unlocks += 1;
  await chrome.storage.local.set({ stats });
}

// ---------------------------------------------------------------------------
// Focus sessions
// ---------------------------------------------------------------------------

async function startFocus(minutes) {
  const focus = { active: true, startedAt: Date.now(), until: Date.now() + minutes * 60e3, minutes };
  cache.focus = focus;
  await chrome.storage.local.set({ focus });
  chrome.alarms.create("focus-end", { when: focus.until });
  // Immediately sweep open tabs.
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const t of tabs) enforceOnTab(t.id, t.url);
}

async function completeFocus() {
  const focus = cache.focus?.active ? cache.focus : (await chrome.storage.local.get("focus")).focus;
  if (focus?.active) {
    const key = dateKey();
    const { stats = {} } = await chrome.storage.local.get("stats");
    stats[key] = stats[key] || { blocks: {}, focusMinutes: 0, unlocks: 0 };
    stats[key].focusMinutes += Math.round((Math.min(Date.now(), focus.until) - focus.startedAt) / 60e3);
    await chrome.storage.local.set({ stats });
    const settings = await getSettings();
    if (settings.buddy.enabled) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: `${settings.buddy.name}: session complete`,
        message: "You stayed the course. That's how momentum is built — one honest block of focus at a time."
      });
    }
  }
  cache.focus = { active: false };
  await chrome.storage.local.set({ focus: { active: false } });
  chrome.alarms.clear("focus-end");
}

// ---------------------------------------------------------------------------
// Message hub (popup / options / blocked page / content scripts)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "getDashboard": {
        const settings = await getSettings();
        const key = dateKey();
        const { usage = {}, stats = {} } = await chrome.storage.local.get(["usage", "stats"]);
        sendResponse({
          settings,
          focus: await getFocus(),
          unlocks: await getUnlocks(),
          todayUsage: usage[key] || {},
          todayStats: stats[key] || { blocks: {}, focusMinutes: 0, unlocks: 0 },
          allStats: stats
        });
        break;
      }
      case "saveSettings": {
        await saveSettings(deepMerge(structuredClone(DEFAULT_SETTINGS), msg.settings));
        sendResponse({ ok: true });
        break;
      }
      case "startFocus": {
        await startFocus(Math.max(1, Math.min(480, msg.minutes)));
        sendResponse({ ok: true });
        break;
      }
      case "endFocus": {
        await completeFocus();
        sendResponse({ ok: true });
        break;
      }
      case "requestUnlock": {
        const settings = await getSettings();
        const focus = await getFocus();
        if (focus.active) { sendResponse({ ok: false, error: "focus" }); break; }
        const mins = Math.max(1, Math.min(settings.strict.maxUnlockMinutes, msg.minutes || 5));
        const unlocks = await getUnlocks();
        unlocks[msg.domain] = Date.now() + mins * 60e3;
        cache.unlocks = unlocks;
        await chrome.storage.local.set({ unlocks });
        await recordUnlock();
        sendResponse({ ok: true, until: unlocks[msg.domain] });
        break;
      }
      case "checkTitle": {
        // Content script reports the page <title>; block if a keyword matches.
        if (sender.tab?.id && sender.tab.url) {
          await enforceOnTab(sender.tab.id, sender.tab.url, msg.title || "");
        }
        sendResponse({ ok: true });
        break;
      }
      case "checkUrl": {
        // Content script saw the URL change without a full navigation (SPA
        // history, or a back/forward-cache restore) — re-enforce.
        if (sender.tab?.id) {
          await enforceOnTab(sender.tab.id, msg.url || sender.tab.url || "");
        }
        sendResponse({ ok: true });
        break;
      }
      case "getUsageFor": {
        sendResponse({ seconds: await getUsageSecondsToday(msg.pattern) });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown" });
    }
  })();
  return true; // async
});
