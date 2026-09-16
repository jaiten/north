// North — Focus Companion
// Background service worker: rules engine, time tracking, schedules, unlocks.

// ---------------------------------------------------------------------------
// Defaults & storage
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "light",             // "light" | "dark" — cosmetic, applies to all North pages
  strict: {
    enabled: true,
    waitSeconds: 60,          // how long you must wait before the challenge
    challenge: "journal",     // "journal" | "phrase" | "math" — journal is always part of it
    maxUnlockMinutes: 15
  },
  buddy: {
    enabled: true,            // nudges: block-page lines, low-budget warnings, session notes
    tone: "kind"              // "kind" | "tough"
  },
  shorts: {
    enabled: true,            // block ALL short-form content everywhere
    blockTikTokEntirely: true,
    allowSharedLinks: true    // a single reel/short opened from outside the platform plays
  },
  // Messages-only modes: DMs stay open, the feed disappears (user opts in)
  messagesOnly: { instagram: false, linkedin: false, facebook: false, x: false },
  // One-time free reversals, keyed by control id. A protection you switched on
  // before you knew what it did can be switched off once without the wait; the
  // key is set the moment that pass is spent, and never cleared. Only the
  // controls in FREE_FIRST_UNDO (options.js) are eligible.
  freeUndoUsed: {},
  // Lighter cleanups: trim the bait without blocking the site
  linkedin: { tidyNav: true },     // hide Home + My Network in the navbar
  twitch: { cleanHome: true },     // calm front page, no recommended channels
  news: { declutter: false },      // strip recommended/trending rails on news outlets
  lockdownAllow: [],          // the only sites reachable during a lockdown
  adultBlock: true,           // category block, always on — enforced in saveSettings and evaluate
  keywords: [],               // blocked keywords (URL + page title)
  youtube: {
    blockShorts: true,
    hideSidebar: true,        // the whole left rail; search stays, direct URLs still work
    hideExplore: true,        // legacy: sidebar Movies & TV, Music, Live links (when sidebar shown)
    hideHomeFeed: false,
    calmHomeFeed: false,      // keep only the first 3 recs, drop the chip bar, shrink thumbnails
    hideRelated: false,
    hideComments: false,
    hideSubscriptions: false,
    titleKeywords: [],        // hide videos whose title/channel matches
    topicMode: false,         // only show videos matching allowedKeywords
    allowedKeywords: []
  },
  betterPlaces: [
    { label: "Khan Academy", url: "https://www.khanacademy.org" },
    { label: "A random Wikipedia article", url: "https://en.wikipedia.org/wiki/Special:Random" },
    { label: "freeCodeCamp", url: "https://www.freecodecamp.org/learn" },
    { label: "A free classic book", url: "https://www.gutenberg.org/ebooks/search/?sort_order=downloads" },
    { label: "Duolingo", url: "https://www.duolingo.com" },
    { label: "MIT OpenCourseWare", url: "https://ocw.mit.edu" },
    { label: "A TED talk", url: "https://www.ted.com/talks" },
    { label: "Typing practice", url: "https://www.keybr.com" },
    { label: "A maths problem to chew on", url: "https://projecteuler.net/archives" }
  ],
  // Empty on purpose: nothing is blocked until the user chooses it.
  sites: []
};

let cache = { settings: null, unlocks: {}, focus: null, lockdown: null, pause: null };

async function getSettings() {
  if (cache.settings) return cache.settings;
  const { settings } = await chrome.storage.local.get("settings");
  const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), settings || {});
  // Migration: instagramDmOnly predates the per-site messagesOnly object.
  if (merged.instagramDmOnly) {
    merged.messagesOnly.instagram = true;
    delete merged.instagramDmOnly;
  }
  cache.settings = merged;
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
  if (changes.lockdown) cache.lockdown = changes.lockdown.newValue || null;
  if (changes.pause) cache.pause = changes.pause.newValue || null;
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
// Shared-link pass: a friend sends you one reel/short/post. That one item
// plays for a few minutes. Granted when the item is opened from OUTSIDE the
// platform (another app, a pasted link) or from a DM conversation. Swiping to
// the next item is blocked because the pass is locked to the exact item id.
//
// Anti-abuse. A pass lasts PASS_MINUTES and dies the moment you navigate away
// from the item, so Back doesn't replay it. An item only ever gets one pass in
// its life: re-opening something you've already watched is an old message, not
// a new one, and old messages are how a feed gets rebuilt one link at a time.
// Beyond that the limits depend on where the link came from:
//
//   • From a DM: the cooldown is per conversation, not global. Three people
//     sending you something while you were away should open as three items,
//     not one — but each of them gets one item per GRANT_COOLDOWN_MINUTES, so
//     a thread full of reels still can't be scrolled through.
//   • From anywhere else (a pasted link, another app): one new pass every
//     GRANT_COOLDOWN_MINUTES, globally, as before.
//
// Whether a message is unread is not something the URL can tell us, and the
// DM page's own DOM is not a thing to trust for a permission check. "One per
// conversation, and never the same item twice" is the honest approximation.
// ---------------------------------------------------------------------------

const PASS_MINUTES = 5;
const GRANT_COOLDOWN_MINUTES = 10;
const SPENT_TTL_DAYS = 7;     // how long an item stays "already watched"
const SPENT_MAX = 300;        // and how many we keep at most

const tabNav = new Map(); // tabId -> { lastUrl, ytTime }

let passCache = null;
async function getPassState() {
  if (!passCache) {
    const { sharePass = {} } = await chrome.storage.local.get("sharePass");
    passCache = {
      lastGrant: sharePass.lastGrant || 0,
      items: sharePass.items || {},      // itemId -> pass expiry
      spent: sharePass.spent || {},      // itemId -> when its pass was granted
      threads: sharePass.threads || {}   // conversation key -> last grant
    };
  }
  return passCache;
}

/**
 * The conversation a navigation came from, as a stable key — "ig:t/17842…",
 * or "ig:inbox" when the thread id isn't in the URL yet. null when the page
 * isn't a DM page at all.
 */
function dmThreadOf(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const path = u.pathname;
  let m;
  if (host.endsWith("instagram.com") && path.startsWith("/direct")) {
    return (m = path.match(/^\/direct\/t\/([\w.-]+)/)) ? `ig:${m[1]}` : "ig:inbox";
  }
  if (host.endsWith("facebook.com") && path.startsWith("/messages")) {
    return (m = path.match(/^\/messages\/(?:t|e2ee\/t)\/([\w.-]+)/)) ? `fb:${m[1]}` : "fb:inbox";
  }
  if (host.endsWith("messenger.com")) {
    return (m = path.match(/^\/t\/([\w.-]+)/)) ? `fb:${m[1]}` : "fb:inbox";
  }
  if (host.endsWith("x.com") && path.startsWith("/messages")) {
    return (m = path.match(/^\/messages\/([\w.-]+)/)) ? `x:${m[1]}` : "x:inbox";
  }
  if (host.endsWith("linkedin.com") && path.startsWith("/messaging")) {
    return (m = path.match(/^\/messaging\/thread\/([\w.-]+)/)) ? `li:${m[1]}` : "li:inbox";
  }
  return null;
}

/** Keep the "already watched" list from growing without bound. */
function pruneSpent(spent) {
  const cutoff = Date.now() - SPENT_TTL_DAYS * 86400e3;
  for (const [id, ts] of Object.entries(spent)) {
    if (ts < cutoff) delete spent[id];
  }
  const ids = Object.keys(spent);
  if (ids.length > SPENT_MAX) {
    ids.sort((a, b) => spent[a] - spent[b])
      .slice(0, ids.length - SPENT_MAX)
      .forEach(id => delete spent[id]);
  }
}

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
  // Posts shared in Instagram DMs open as /p/<id>. Only legit from DMs.
  if (host.endsWith("instagram.com") && (m = u.pathname.match(/^\/p\/([\w-]+)/))) {
    return { platform: "ig", id: m[1], dmOnlySource: true };
  }
  if (host.endsWith("facebook.com") && (m = u.pathname.match(/^\/reel\/([\w-]+)/))) {
    return { platform: "fb", id: m[1] };
  }
  return null;
}

function rootDomain(host) { return host.split(".").slice(-2).join("."); }

async function sharePassAllows(tabId, url, settings) {
  if (!settings.shorts.allowSharedLinks || tabId == null) return false;
  const item = shortFormItem(url);
  if (!item) return false;

  const pass = await getPassState();

  // An active pass for this exact item keeps working (any tab, survives restarts).
  if (pass.items[item.id] && pass.items[item.id] > Date.now()) return true;

  // One pass per item, ever. A second look at the same reel is a re-watch, and
  // re-watching is how the five-minute pass would become an evening.
  if (pass.spent[item.id]) return false;

  // Where did this navigation come from?
  const prev = tabNav.get(tabId)?.lastUrl;
  let external = false;
  let thread = null;
  if (!prev) {
    external = true; // fresh tab: opened from another app or a link click
  } else {
    try {
      const prevHost = new URL(prev).hostname.replace(/^www\./, "");
      const curHost = new URL(url).hostname.replace(/^www\./, "");
      external = rootDomain(prevHost) !== rootDomain(curHost);
      thread = dmThreadOf(prev);
    } catch { /* ignore */ }
  }
  const legit = item.dmOnlySource ? !!thread : (external || !!thread);
  if (!legit) return false;

  // Rate limit. A DM carries its own lane, so several people sending you
  // something at once open as several items; everything else shares one lane.
  const cooldown = GRANT_COOLDOWN_MINUTES * 60e3;
  const lastForSource = thread ? (pass.threads[thread] || 0) : (pass.lastGrant || 0);
  if (Date.now() - lastForSource < cooldown) return false;

  for (const k of Object.keys(pass.items)) {
    if (pass.items[k] < Date.now()) delete pass.items[k];
  }
  pass.items[item.id] = Date.now() + PASS_MINUTES * 60e3;
  pass.spent[item.id] = Date.now();
  // The two lanes are independent: a message from a friend shouldn't close the
  // door on a link someone emails you a minute later, or the other way round.
  if (thread) pass.threads[thread] = Date.now();
  else pass.lastGrant = Date.now();
  pruneSpent(pass.spent);
  // Conversations you haven't opened a link from in a while can go too.
  for (const [k, ts] of Object.entries(pass.threads)) {
    if (ts < Date.now() - cooldown) delete pass.threads[k];
  }
  await chrome.storage.local.set({ sharePass: pass });
  return true;
}

// ---------------------------------------------------------------------------
// Messages-only mode: keep the conversations, lose the feed. Per-site.
// The root URL redirects straight to the inbox; auth/legal paths stay open so
// logging in still works.
// ---------------------------------------------------------------------------

const MESSAGES_ONLY = {
  instagram: {
    host: "instagram.com",
    home: "https://www.instagram.com/direct/inbox/",
    allow: ["/direct", "/accounts", "/api", "/login", "/logout",
      "/challenge", "/two_factor", "/static", "/graphql", "/ajax", "/legal"]
  },
  linkedin: {
    host: "linkedin.com",
    home: "https://www.linkedin.com/messaging/",
    allow: ["/messaging", "/jobs", "/job", "/my-items/saved-jobs",
      "/login", "/checkpoint", "/uas",
      "/authwall", "/psettings", "/mypreferences", "/legal", "/help"]
  },
  facebook: {
    host: "facebook.com", // messenger.com is untouched either way
    home: "https://www.facebook.com/messages",
    allow: ["/messages", "/login", "/checkpoint", "/recover", "/settings",
      "/security", "/privacy", "/legal", "/help", "/ajax", "/api"]
  },
  x: {
    host: "x.com",
    home: "https://x.com/messages",
    allow: ["/messages", "/i", "/login", "/logout", "/flow", "/account",
      "/settings", "/tos", "/privacy"]
  }
};

function messagesOnlyVerdict(url, settings) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  for (const [key, site] of Object.entries(MESSAGES_ONLY)) {
    if (!settings.messagesOnly?.[key]) continue;
    if (host !== site.host && !host.endsWith("." + site.host)) continue;
    const path = u.pathname;
    if (path === "/" || path === "") return { redirect: site.home };
    if (site.allow.some(p => path.startsWith(p))) return null; // allowed
    return { block: true, site: site.host, home: site.home };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The one-minute pause: a door, not a light switch.
//
// A brand new user hasn't earned trust in the friction yet, so the first three
// days carry one free pause a day: everything off for exactly one minute, then
// it all comes back on its own. After the third day — or after today's pass is
// spent — the same button still works, but it costs the usual wait and
// challenge. Lockdowns and focus sessions are never pausable; they're the two
// things people ask North to hold for them.
// ---------------------------------------------------------------------------

const PAUSE_MINUTES = 1;
const FREE_PAUSE_DAYS = 3;        // calendar days from install, inclusive
const FREE_PAUSES_PER_DAY = 1;

async function getMeta() {
  const { meta = {} } = await chrome.storage.local.get("meta");
  if (!meta.installedAt) {
    meta.installedAt = Date.now();
    await chrome.storage.local.set({ meta });
  }
  return meta;
}

/** 0 on the day North was installed, 1 the next calendar day, and so on. */
function calendarDaysSince(ts) {
  const a = new Date(ts); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400e3);
}

async function getPause() {
  if (cache.pause === null) {
    const { pause = { until: 0 } } = await chrome.storage.local.get("pause");
    cache.pause = pause;
  }
  return cache.pause || { until: 0 };
}

async function pauseState() {
  const meta = await getMeta();
  const { pauseUse = {} } = await chrome.storage.local.get("pauseUse");
  const pause = await getPause();
  const dayIndex = calendarDaysSince(meta.installedAt);
  const inTrial = dayIndex >= 0 && dayIndex < FREE_PAUSE_DAYS;
  const usedToday = pauseUse[dateKey()] || 0;
  return {
    minutes: PAUSE_MINUTES,
    active: (pause.until || 0) > Date.now(),
    until: pause.until || 0,
    freeLeft: inTrial ? Math.max(0, FREE_PAUSES_PER_DAY - usedToday) : 0,
    // Days of the free allowance still to come, today included.
    trialDaysLeft: inTrial ? FREE_PAUSE_DAYS - dayIndex : 0
  };
}

/**
 * Start a pause. `free` spends one of the trial passes and is refused when
 * none is left — the caller never gets to decide that for itself.
 */
async function startPause({ free = false } = {}) {
  if ((await getLockdown()).active) return { ok: false, error: "lockdown" };
  if ((await getFocus()).active) return { ok: false, error: "focus" };

  const state = await pauseState();
  if (free) {
    if (!state.freeLeft) return { ok: false, error: "nofree" };
    const { pauseUse = {} } = await chrome.storage.local.get("pauseUse");
    pauseUse[dateKey()] = (pauseUse[dateKey()] || 0) + 1;
    await chrome.storage.local.set({ pauseUse });
  }

  const pause = { until: Date.now() + PAUSE_MINUTES * 60e3, startedAt: Date.now() };
  cache.pause = pause;
  await chrome.storage.local.set({ pause });
  chrome.alarms.create("pause-end", { when: pause.until });
  return { ok: true, until: pause.until, freeLeft: (await pauseState()).freeLeft };
}

/** The minute is up: protection is back, and the open tabs hear about it. */
async function endPause() {
  cache.pause = { until: 0 };
  await chrome.storage.local.set({ pause: { until: 0 } });
  chrome.alarms.clear("pause-end");
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const t of tabs) enforceOnTab(t.id, t.url);
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

  // 0. Adult content — always blocked, regardless of any stored flag.
  if (isAdult(url, title)) {
    return { reason: "adult", site: host };
  }

  // 0.5 Lockdown: allowlist or nothing, no unlocks, no shared passes, until
  // the clock runs out. Allowlisted sites still face the normal rules below.
  const lockdown = await getLockdown();
  if (lockdown.active) {
    const allowed = (settings.lockdownAllow || []).some(p => domainMatches(host, p));
    if (!allowed) return { reason: "lockdown", site: host, detail: String(lockdown.until) };
  }

  const focus = await getFocus();

  // A running pause lifts everything below (adult content and lockdown, above,
  // are never part of the deal). A focus session outranks it.
  if (!focus.active && (await getPause()).until > Date.now()) return null;

  const unlocks = await getUnlocks();
  const unlockedUntil = Object.entries(unlocks)
    .find(([d, until]) => domainMatches(host, d) && until > Date.now());
  const isUnlocked = !!unlockedUntil && !focus.active; // unlocks don't apply during focus

  // A single shared reel/short opened from outside the platform may pass the
  // short-form and DM-only checks, but NOT site rules, keywords or focus.
  const shared = !focus.active && await sharePassAllows(tabId, url, settings);

  // 1. Short-form content — never unlockable, by design.
  if (settings.shorts.enabled && !shared && isShortForm(url, settings)) {
    return { reason: "shorts", site: host };
  }

  // 2. Messages-only sites.
  if (!isUnlocked && !shared) {
    const v = messagesOnlyVerdict(url, settings);
    if (v?.redirect) return { reason: "msg-redirect", redirect: v.redirect };
    if (v?.block) return { reason: "dmonly", site: v.site, detail: v.home };
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

// If a YouTube video gets blocked mid-watch (limit ran out), remember where
// playback was so coming back resumes instead of restarting.
function withResumeTime(tabId, url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("youtube.com") || u.pathname !== "/watch") return url;
    const vid = u.searchParams.get("v");
    const yt = tabNav.get(tabId)?.ytTime;
    if (vid && yt && yt.videoId === vid && Date.now() - yt.ts < 5 * 60e3 && yt.t > 10) {
      u.searchParams.set("t", Math.max(0, Math.floor(yt.t) - 2) + "s");
      return u.toString();
    }
  } catch { /* ignore */ }
  return url;
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

// One navigation fires several webNavigation/tabs events in a burst; dedupe
// so a single blocked visit is redirected and counted once. The two windows
// matter: within BURST_MS it's the same navigation (skip everything), within
// COUNT_MS it's the user re-trying (Back button) — redirect again, but don't
// double-count the stat. Never skip the redirect outside the burst window:
// that's how "press Back twice fast" used to sneak through.
const BURST_MS = 800;
const COUNT_MS = 3000;
const recentBlocks = new Map(); // tabId -> { url, ts }

// A shared-link pass is single-visit: navigating away from the item (to the
// feed, another item, anywhere) expires it immediately. Without this, Back
// would replay the reel for the rest of its 5-minute window.
async function expirePassOnLeave(tabId, url) {
  const prev = tabNav.get(tabId)?.lastUrl;
  if (!prev || prev === url) return;
  const prevItem = shortFormItem(prev);
  if (!prevItem) return;
  const cur = shortFormItem(url);
  if (cur && cur.id === prevItem.id) return; // same item, e.g. a query param changed
  const pass = await getPassState();
  if (pass.items[prevItem.id]) {
    delete pass.items[prevItem.id];
    await chrome.storage.local.set({ sharePass: pass });
  }
}

async function enforceOnTab(tabId, url, title = "") {
  await expirePassOnLeave(tabId, url);
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
  const sameUrl = last && last.url === url;
  if (sameUrl && Date.now() - last.ts < BURST_MS) return true;
  const isRetry = sameUrl && Date.now() - last.ts < COUNT_MS;
  recentBlocks.set(tabId, { url, ts: Date.now() });
  const target = verdict.redirect || blockedPageUrl(verdict, withResumeTime(tabId, url));
  if (!verdict.redirect && !isRetry) await recordBlock(verdict.site || hostnameOf(url));
  try { await chrome.tabs.update(tabId, { url: target }); } catch { /* tab gone */ }
  return true;
}

chrome.tabs.onRemoved.addListener(tabId => {
  recentBlocks.delete(tabId);
  tabNav.delete(tabId);
});

// Links in a DM often open in a new tab, which would otherwise arrive with no
// history at all and be treated as "pasted from another app". Carrying the
// conversation over keeps the per-conversation lane honest — and only DM pages
// are inherited, so nothing else gains a pass it wouldn't have had.
chrome.tabs.onCreated.addListener(tab => {
  if (tab.openerTabId == null || tab.id == null) return;
  const prev = tabNav.get(tab.openerTabId)?.lastUrl;
  if (prev && dmThreadOf(prev)) tabNav.set(tab.id, { lastUrl: prev });
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
  await getMeta();                        // stamps installedAt, once, for the free pauses
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/options.html") + "#welcome" });
  }
  // Uninstall friction: a goodbye page that shows what you're walking away from.
  try { chrome.runtime.setUninstallURL("https://northfocus.app/goodbye.html"); } catch { /* ignore */ }
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("tick", { periodInMinutes: 1 }));

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === "tick") {
    await flushTracking();
    // A pause that expired while the worker was asleep still has to be closed
    // out, so the tabs get swept even if the alarm never fired.
    const pause = await getPause();
    if (pause.until && pause.until <= Date.now()) await endPause();
    await enforceLimitsOnActiveTab();
    await pruneOldData();
  }
  if (alarm.name === "focus-end") await completeFocus();
  if (alarm.name === "lockdown-end") await completeLockdown();
  if (alarm.name === "pause-end") await endPause();
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
      sendNudge(tab.id, `${leftMin} minute${leftMin === 1 ? "" : "s"} left on ${site.pattern} today. Make it count, then head back.`);
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

async function recordUnlock(domain, minutes, note) {
  const key = dateKey();
  const { stats = {} } = await chrome.storage.local.get("stats");
  stats[key] = stats[key] || { blocks: {}, focusMinutes: 0, unlocks: 0 };
  stats[key].unlocks += 1;
  await chrome.storage.local.set({ stats });
  // The unlock journal: their own words, kept so they can re-read them later.
  if (note) {
    const { journal = [] } = await chrome.storage.local.get("journal");
    journal.unshift({ t: Date.now(), site: domain || "", mins: minutes, note: String(note).slice(0, 600) });
    journal.length = Math.min(journal.length, 100);
    await chrome.storage.local.set({ journal });
  }
}

// The journal entry is the unlock challenge, so it has to be real writing:
// enough words, mostly distinct, and not keyboard mash.
const JOURNAL_MIN_WORDS = 20;

function journalNoteOk(note) {
  const words = String(note || "").toLowerCase().split(/\s+/).filter(w => /[a-z]/i.test(w));
  if (words.length < JOURNAL_MIN_WORDS) return false;
  const unique = new Set(words);
  if (unique.size < JOURNAL_MIN_WORDS / 2) return false;          // "i need it i need it…"
  const withVowels = words.filter(w => /[aeiouy]/i.test(w)).length;
  return withVowels >= words.length * 0.7;                        // "sdfk jhgf dkfj…"
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
        title: "North: session complete",
        message: "You stayed with it the whole way through. That's how momentum gets built — one session at a time."
      });
    }
  }
  cache.focus = { active: false };
  await chrome.storage.local.set({ focus: { active: false } });
  chrome.alarms.clear("focus-end");
}

// ---------------------------------------------------------------------------
// Lockdown: allowlist-only mode for a fixed duration. There is deliberately
// no way to end it early — not even the challenge. That's the product.
// ---------------------------------------------------------------------------

async function getLockdown() {
  if (cache.lockdown === null) {
    const { lockdown = { active: false } } = await chrome.storage.local.get("lockdown");
    cache.lockdown = lockdown;
  }
  if (cache.lockdown?.active && cache.lockdown.until < Date.now()) {
    await completeLockdown();
  }
  return cache.lockdown || { active: false };
}

async function startLockdown(minutes) {
  const lockdown = { active: true, startedAt: Date.now(), until: Date.now() + minutes * 60e3, minutes };
  cache.lockdown = lockdown;
  await chrome.storage.local.set({ lockdown });
  chrome.alarms.create("lockdown-end", { when: lockdown.until });
  // Immediately sweep open tabs.
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const t of tabs) enforceOnTab(t.id, t.url);
}

async function completeLockdown() {
  const lockdown = cache.lockdown?.active ? cache.lockdown : (await chrome.storage.local.get("lockdown")).lockdown;
  cache.lockdown = { active: false };
  await chrome.storage.local.set({ lockdown: { active: false } });
  chrome.alarms.clear("lockdown-end");
  if (lockdown?.active) {
    const settings = await getSettings();
    if (settings.buddy.enabled) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "North: lockdown complete",
        message: "You held the line for the full stretch. The internet is yours again — spend it deliberately."
      });
    }
  }
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
        const { usage = {}, stats = {}, journal = [] } = await chrome.storage.local.get(["usage", "stats", "journal"]);
        sendResponse({
          settings,
          focus: await getFocus(),
          lockdown: await getLockdown(),
          pause: await pauseState(),
          unlocks: await getUnlocks(),
          journal,
          todayUsage: usage[key] || {},
          todayStats: stats[key] || { blocks: {}, focusMinutes: 0, unlocks: 0 },
          allStats: stats
        });
        break;
      }
      case "saveSettings": {
        const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), msg.settings);
        merged.adultBlock = true; // not negotiable, even via imported settings
        await saveSettings(merged);
        sendResponse({ ok: true });
        break;
      }
      case "startFocus": {
        await startFocus(Math.max(1, Math.min(480, msg.minutes)));
        sendResponse({ ok: true });
        break;
      }
      case "startLockdown": {
        // 15 min to 7 days. No endLockdown handler exists, on purpose.
        await startLockdown(Math.max(15, Math.min(7 * 24 * 60, msg.minutes)));
        sendResponse({ ok: true });
        break;
      }
      case "endFocus": {
        await completeFocus();
        sendResponse({ ok: true });
        break;
      }
      case "getPause": {
        sendResponse(await pauseState());
        break;
      }
      case "startPause": {
        sendResponse(await startPause({ free: !!msg.free }));
        break;
      }
      case "endPause": {
        await endPause();
        sendResponse({ ok: true });
        break;
      }
      case "requestUnlock": {
        const settings = await getSettings();
        const focus = await getFocus();
        if (focus.active) { sendResponse({ ok: false, error: "focus" }); break; }
        if (!journalNoteOk(msg.note)) { sendResponse({ ok: false, error: "note" }); break; }
        const mins = Math.max(1, Math.min(settings.strict.maxUnlockMinutes, msg.minutes || 5));
        const unlocks = await getUnlocks();
        unlocks[msg.domain] = Date.now() + mins * 60e3;
        cache.unlocks = unlocks;
        await chrome.storage.local.set({ unlocks });
        await recordUnlock(msg.domain, mins, msg.note);
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
        // history, or a back/forward-cache restore). Re-enforce.
        if (sender.tab?.id) {
          await enforceOnTab(sender.tab.id, msg.url || sender.tab.url || "");
        }
        sendResponse({ ok: true });
        break;
      }
      case "ytTime": {
        // YouTube content script reports playback position for limit-block resume.
        if (sender.tab?.id) {
          const nav = tabNav.get(sender.tab.id) || {};
          nav.ytTime = { videoId: msg.videoId, t: msg.t, ts: Date.now() };
          tabNav.set(sender.tab.id, nav);
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
