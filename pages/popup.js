// North — popup logic

const $ = id => document.getElementById(id);
let dash = null;
let focusTicker = null;

const GREETINGS = {
  kind: [
    "good to see you. what's the one thing that matters most right now?",
    "every blocked tab is a small vote for the person you're becoming.",
    "you don't need more willpower. you need fewer open doors. i closed some for you.",
    "progress isn't loud. it's just a day with fewer detours."
  ],
  tough: [
    "stats don't lie. keep the dodge count up and the unlock count at zero.",
    "the feed misses you. don't text back.",
    "discipline is remembering what you want. consider this your reminder."
  ],
  goodDay: [
    "{n} distractions dodged today. that's real time you got back.",
    "{n} blocked attempts today. each one was a fork in the road and you took the right turn."
  ]
};

async function load() {
  dash = await chrome.runtime.sendMessage({ type: "getDashboard" });
  const s = dash.settings;
  northApplyTheme(s.theme || "light");

  // Status
  $("toggle-enabled").checked = s.enabled;
  $("status-tag").textContent = s.enabled ? "protection on" : "protection OFF";
  $("status-tag").classList.toggle("off", !s.enabled);
  $("enabled-label").textContent = s.enabled ? "protection on" : "protection off";

  // Buddy line
  const tone = s.buddy?.tone === "tough" ? "tough" : "kind";
  const totalBlocks = Object.values(dash.todayStats.blocks || {}).reduce((a, b) => a + b, 0);
  let msg;
  if (totalBlocks >= 5 && Math.random() < 0.6) {
    msg = GREETINGS.goodDay[Math.floor(Math.random() * GREETINGS.goodDay.length)].replace("{n}", totalBlocks);
  } else {
    msg = GREETINGS[tone][Math.floor(Math.random() * GREETINGS[tone].length)];
  }
  $("buddy-msg").textContent = s.buddy?.enabled ? msg : "buddy is off. the blocks still hold.";

  // What's actively protected right now
  const chips = [];
  if (dash.lockdown?.active && dash.lockdown.until > Date.now()) {
    const left = Math.ceil((dash.lockdown.until - Date.now()) / 60e3);
    chips.push(`lockdown: ${left >= 60 ? Math.floor(left / 60) + "h " + (left % 60) + "m" : left + "m"} left`);
  }
  if (s.enabled) {
    if (s.shorts?.enabled) chips.push("shorts blocked");
    if (s.adultBlock) chips.push("18+ blocked");
    const MO_NAMES = { instagram: "Instagram", linkedin: "LinkedIn", facebook: "Facebook", x: "X" };
    const mo = Object.entries(s.messagesOnly || {}).filter(([, on]) => on).map(([k]) => MO_NAMES[k]);
    if (mo.length) chips.push(`${mo.join(", ")}: DMs only`);
    if (s.sites?.length) chips.push(`${s.sites.length} site${s.sites.length === 1 ? "" : "s"} guarded`);
    if (s.keywords?.length) chips.push(`${s.keywords.length} keyword${s.keywords.length === 1 ? "" : "s"}`);
  }
  const streak = cleanStreak();
  if (streak >= 2) chips.push(`${streak}-day no-unlock streak`);
  $("prot-row").innerHTML = chips.map(c => `<span class="prot-chip">${c}</span>`).join("");

  // Nori wears the day on its face.
  $("mini-orb").classList.toggle("sleepy", (dash.todayStats.unlocks || 0) >= 2);

  // Stats
  $("stat-blocks").textContent = totalBlocks;
  $("stat-focus").textContent = formatMins(dash.todayStats.focusMinutes || 0);
  $("stat-unlocks").textContent = dash.todayStats.unlocks || 0;

  // Usage bars (top 4)
  const entries = Object.entries(dash.todayUsage || {})
    .sort((a, b) => b[1] - a[1])
    .filter(([, secs]) => secs >= 60)
    .slice(0, 4);
  const max = entries[0]?.[1] || 1;
  $("usage-bars").innerHTML = entries.map(([host, secs]) => `
    <div class="usage-item">
      <div class="usage-top">
        <span class="usage-site">${esc(host)}</span>
        <span class="usage-time">${formatMins(Math.round(secs / 60))}</span>
      </div>
      <div class="usage-bar"><div class="usage-fill" style="width:${Math.max(4, (secs / max) * 100)}%"></div></div>
    </div>`).join("") || `<p class="dim" style="margin:0">no browsing tracked yet today.</p>`;

  // Focus state
  renderFocus();
}

function renderFocus() {
  const f = dash.focus;
  const active = f?.active && f.until > Date.now();
  $("focus-idle").classList.toggle("hidden", active);
  $("focus-active").classList.toggle("hidden", !active);
  clearInterval(focusTicker);
  if (active) {
    const tick = () => {
      const left = Math.max(0, f.until - Date.now());
      const m = Math.floor(left / 60e3), sec = Math.floor((left % 60e3) / 1000);
      $("focus-remaining").textContent = `${m}:${String(sec).padStart(2, "0")}`;
      if (left <= 0) { clearInterval(focusTicker); load(); }
    };
    tick();
    focusTicker = setInterval(tick, 1000);
  }
}

function formatMins(m) {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

// Consecutive days (today backwards) with activity recorded and zero unlocks.
function cleanStreak() {
  const stats = dash.allStats || {};
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.now() - i * 86400e3);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const day = stats[key];
    if (!day) { if (i === 0) continue; break; } // quiet today is fine; gaps end the streak
    if ((day.unlocks || 0) > 0) break;
    n++;
  }
  return n;
}
function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Focus controls ---

let selectedMins = 25;
document.querySelectorAll("#focus-card .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#focus-card .chip").forEach(c => c.classList.remove("selected"));
    chip.classList.add("selected");
    selectedMins = Number(chip.dataset.mins);
    $("focus-custom").value = "";
  });
});
document.querySelector('#focus-card .chip[data-mins="25"]').classList.add("selected");

$("focus-custom").addEventListener("input", e => {
  if (e.target.value) {
    document.querySelectorAll("#focus-card .chip").forEach(c => c.classList.remove("selected"));
    selectedMins = Number(e.target.value);
  }
});

$("btn-focus").addEventListener("click", async () => {
  if (!selectedMins || selectedMins < 1) return;
  await chrome.runtime.sendMessage({ type: "startFocus", minutes: selectedMins });
  await load();
});

// Ending focus early and disabling protection both route through the
// challenge gate on the options page — friction by design.
$("btn-end-focus").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/options.html") + "#gate=endFocus" });
});

$("toggle-enabled").addEventListener("change", async e => {
  if (e.target.checked) {
    dash.settings.enabled = true;
    await chrome.runtime.sendMessage({ type: "saveSettings", settings: dash.settings });
    await load();
  } else {
    e.target.checked = true; // revert — disabling requires the gate
    if (dash.settings.strict?.enabled) {
      chrome.tabs.create({ url: chrome.runtime.getURL("pages/options.html") + "#gate=disable" });
    } else {
      dash.settings.enabled = false;
      await chrome.runtime.sendMessage({ type: "saveSettings", settings: dash.settings });
      await load();
    }
  }
});

$("btn-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

// Poke Nori, get another line.
$("mini-orb").addEventListener("click", () => {
  if (!dash?.settings?.buddy?.enabled) return;
  const tone = dash.settings.buddy.tone === "tough" ? "tough" : "kind";
  const lines = GREETINGS[tone];
  const current = $("buddy-msg").textContent;
  const others = lines.filter(l => l !== current);
  $("buddy-msg").textContent = others[Math.floor(Math.random() * others.length)] || current;
  $("mini-orb").animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
    { duration: 300, easing: "ease-out" }
  );
});

// Suggest Incognito coverage — the blocks should hold everywhere.
try {
  chrome.extension.isAllowedIncognitoAccess(allowed => {
    $("incog-banner").classList.toggle("hidden", !!allowed);
  });
} catch { /* preview environment */ }
$("incog-fix").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
});

load();
