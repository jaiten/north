// Dev-only harness: mocks the chrome.* APIs so the pages can be developed and
// visually tested in a plain browser tab (e.g. `npx http-server`).
// Inside the real extension `chrome.runtime.id` exists, so this entire file
// is a no-op there.
(() => {
  if (globalThis.chrome?.runtime?.id) return;

  const fixtureSettings = {
    enabled: true,
    strict: { enabled: true, waitSeconds: 8, challenge: "phrase", maxUnlockMinutes: 15 },
    buddy: { enabled: true, name: "Nori", tone: "kind" },
    shorts: { enabled: true, blockTikTokEntirely: true, allowSharedLinks: true },
    instagramDmOnly: true,
    adultBlock: true,
    keywords: ["celebrity gossip", "drama"],
    youtube: { blockShorts: true, hideHomeFeed: true, hideRelated: false, hideComments: false, hideSubscriptions: false, titleKeywords: ["reaction", "gone wrong"] },
    betterPlaces: [
      { label: "Learn something on Khan Academy", url: "https://www.khanacademy.org" },
      { label: "A random Wikipedia article", url: "https://en.wikipedia.org/wiki/Special:Random" },
      { label: "Practice coding on freeCodeCamp", url: "https://www.freecodecamp.org/learn" }
    ],
    sites: [
      { id: "s_x", pattern: "x.com", mode: "always", schedule: [], limitMins: 0 },
      { id: "s_rd", pattern: "reddit.com", mode: "limit", schedule: [], limitMins: 20 },
      { id: "s_tw", pattern: "twitch.tv", mode: "schedule", schedule: [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }], limitMins: 0 }
    ]
  };

  const day = 86400e3;
  const dk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const allStats = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() - i * day);
    allStats[dk(d)] = {
      blocks: { "x.com": Math.floor(Math.random() * 9), "reddit.com": Math.floor(Math.random() * 6), "youtube.com": Math.floor(Math.random() * 4) },
      focusMinutes: Math.floor(Math.random() * 120),
      unlocks: Math.floor(Math.random() * 3)
    };
  }

  const dashboard = {
    settings: fixtureSettings,
    focus: { active: false },
    unlocks: {},
    todayUsage: { "reddit.com": 14 * 60, "youtube.com": 38 * 60, "x.com": 6 * 60, "github.com": 95 * 60 },
    todayStats: allStats[dk(new Date())],
    allStats
  };

  globalThis.chrome = {
    runtime: {
      sendMessage: async msg => {
        console.log("[dev-shim] sendMessage", msg);
        if (msg.type === "getDashboard") return structuredClone(dashboard);
        if (msg.type === "getUsageFor") return { seconds: 14 * 60 };
        if (msg.type === "requestUnlock") return { ok: true, until: Date.now() + 6e5 };
        return { ok: true };
      },
      getURL: p => "/" + p,
      openOptionsPage: () => { location.href = "/pages/options.html"; },
      onMessage: { addListener: () => {} }
    },
    tabs: { create: ({ url }) => { location.href = url; } },
    extension: { isAllowedIncognitoAccess: cb => cb(false) },
    storage: {
      local: {
        get: async () => ({ settings: structuredClone(fixtureSettings) }),
        set: async () => {}
      },
      onChanged: { addListener: () => {} }
    }
  };
  console.log("[dev-shim] chrome API mocked for preview");
})();
