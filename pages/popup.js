// North — popup logic

const $ = id => document.getElementById(id);
let dash = null;
let focusTicker = null;
let pauseTicker = null;

async function load() {
  dash = await chrome.runtime.sendMessage({ type: "getDashboard" });
  const s = dash.settings;
  northApplyTheme(s.theme || "light");

  // Status
  $("toggle-enabled").checked = s.enabled;
  $("status-tag").textContent = s.enabled ? "Protection on" : "Protection off";
  $("status-tag").classList.toggle("off", !s.enabled);
  $("enabled-label").textContent = s.enabled ? "Protection on" : "Protection off";

  // Stats
  const totalBlocks = Object.values(dash.todayStats.blocks || {}).reduce((a, b) => a + b, 0);
  $("stat-blocks").textContent = totalBlocks;
  $("stat-focus").textContent = formatMins(dash.todayStats.focusMinutes || 0);
  $("stat-unlocks").textContent = dash.todayStats.unlocks || 0;

  // Usage bars (top 3)
  const entries = Object.entries(dash.todayUsage || {})
    .sort((a, b) => b[1] - a[1])
    .filter(([, secs]) => secs >= 60)
    .slice(0, 3);
  const max = entries[0]?.[1] || 1;
  $("usage-bars").innerHTML = entries.map(([host, secs]) => `
    <div class="usage-item">
      <div class="usage-top">
        <span class="usage-site">${esc(host)}</span>
        <span class="usage-time">${formatMins(Math.round(secs / 60))}</span>
      </div>
      <div class="usage-bar"><div class="usage-fill" style="width:${Math.max(4, (secs / max) * 100)}%"></div></div>
    </div>`).join("") || `<p class="dim" style="margin:0">No browsing tracked yet today.</p>`;

  // Focus state
  renderFocus();
  renderPause();
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

// ---------------------------------------------------------------------------
// The one-minute pause. Free once a day for the first three days; after that
// the button is still here, it just costs the wait and the challenge.
// ---------------------------------------------------------------------------

function renderPause() {
  const p = dash.pause || { active: false, freeLeft: 0, trialDaysLeft: 0, minutes: 1 };
  const live = p.active && p.until > Date.now();
  $("pause-idle").classList.toggle("hidden", live);
  $("pause-live").classList.toggle("hidden", !live);

  clearInterval(pauseTicker);
  // While it runs, the header and footer say so too — "Protection on" over a
  // running pause would be a lie in the one place people check.
  $("status-tag").classList.toggle("paused", !!live);
  if (live) {
    $("status-tag").textContent = "Paused for a minute";
    $("enabled-label").textContent = "Paused, back on in a moment";
    const tick = () => {
      const left = Math.max(0, p.until - Date.now());
      const m = Math.floor(left / 60e3), sec = Math.floor((left % 60e3) / 1000);
      $("pause-remaining").textContent = `${m}:${String(sec).padStart(2, "0")}`;
      if (left <= 0) { clearInterval(pauseTicker); load(); }
    };
    tick();
    pauseTicker = setInterval(tick, 1000);
    return;
  }

  // A lockdown or a focus session is exactly what someone asked North to hold.
  // The pause doesn't reach either of them.
  const lockdown = dash.lockdown?.active && dash.lockdown.until > Date.now();
  const focusing = dash.focus?.active && dash.focus.until > Date.now();
  const tag = $("pause-tag");
  const btn = $("btn-pause");
  btn.disabled = !!(lockdown || focusing);

  if (lockdown || focusing) {
    tag.textContent = lockdown ? "Not during lockdown" : "Not during focus";
    tag.className = "pause-tag spent";
    $("pause-note").textContent = lockdown
      ? "Lockdown has no off switch — not even for a minute. It ends when the clock ends."
      : "You're mid session. The pause comes back when the timer does.";
    return;
  }

  if (p.freeLeft > 0) {
    tag.textContent = "Free today";
    tag.className = "pause-tag";
    $("pause-note").textContent =
      `Free while North is new to you: one minute a day for your first three days, ${p.trialDaysLeft} ${p.trialDaysLeft === 1 ? "day" : "days"} left. After that, pausing takes the wait and the challenge.`;
  } else if (p.trialDaysLeft > 0) {
    tag.textContent = "Used today";
    tag.className = "pause-tag spent";
    $("pause-note").textContent =
      `Today's free minute is spent. There's another tomorrow, for ${p.trialDaysLeft - 1} more ${p.trialDaysLeft - 1 === 1 ? "day" : "days"}. Until then, pausing takes the wait and the challenge.`;
  } else {
    tag.textContent = "Takes the challenge";
    tag.className = "pause-tag spent";
    $("pause-note").textContent =
      "Your free minutes were for the first three days. Pausing now takes the wait and the challenge, same as any other way off.";
  }
}

$("btn-pause").addEventListener("click", async () => {
  const p = dash.pause || {};
  if (p.freeLeft > 0) {
    const res = await chrome.runtime.sendMessage({ type: "startPause", free: true });
    if (res?.ok) { await load(); return; }
  }
  // No free pass left: the pause goes through the same gate as everything else.
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/options.html") + "#gate=pause" });
  window.close();
});

$("btn-end-pause").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "endPause" });
  await load();
});

function formatMins(m) {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
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
