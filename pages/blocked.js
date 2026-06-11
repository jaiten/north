// North — blocked page logic

const params = new URLSearchParams(location.search);
const reason = params.get("reason") || "blocklist";
const site = params.get("site") || "";
const detail = params.get("detail") || "";
const fromUrl = params.get("from") || "";

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Buddy copy — kind and tough variants per reason
// ---------------------------------------------------------------------------

const LINES = {
  shorts: {
    kind: [
      "Short-form is engineered to eat hours in 15-second bites. You deserve hours that add up to something.",
      "The algorithm wanted the next 40 minutes of your life. I said no on your behalf.",
      "Nothing in that feed will still matter tomorrow. What you're avoiding probably will."
    ],
    tough: [
      "Shorts again? You know exactly how that ends. Closed.",
      "That feed is a slot machine. You're better than a slot machine.",
      "You didn't even want this. Your thumb did. Overruled."
    ],
    headline: "Short-form stays closed."
  },
  instagram: {
    kind: [
      "Messages are open if someone needs you. The feed can wait forever — it's designed to.",
      "I kept your DMs reachable. Everything else on Instagram is a rabbit hole with no bottom."
    ],
    tough: [
      "DMs only. The feed is not a place, it's a trap with good lighting.",
      "If it's not a message from a real person, it's not worth your attention."
    ],
    headline: "Instagram is DMs-only right now."
  },
  keyword: {
    kind: [
      "You asked me to keep this topic out of reach — that past-you was thinking clearly. Trust them.",
      "This matched a keyword you chose to block. Future-you says thanks."
    ],
    tough: [
      "You literally wrote this keyword down as a no-go. Hold the line.",
      "Blocked by your own rule. Don't negotiate with yourself mid-craving."
    ],
    headline: "That topic is off-limits."
  },
  schedule: {
    kind: [
      "This site is scheduled off right now. The version of you who set that schedule was protecting this exact moment.",
      "It'll be there when the window opens. Right now belongs to your real work."
    ],
    tough: [
      "It's blocked hours. You set them. Honor them.",
      "Clock says focus time. The site will survive without you."
    ],
    headline: "Not during these hours."
  },
  limit: {
    kind: [
      "You've used your time here today — and that's fine, it was budgeted. Now the budget's spent.",
      "Today's allowance for this site is done. Tomorrow it resets. Tonight, you're free."
    ],
    tough: [
      "Time's up. More scrolling won't find what the first 20 minutes didn't.",
      "Daily limit hit. The feed doesn't have an ending — but your day does."
    ],
    headline: "You've hit today's limit."
  },
  focus: {
    kind: [
      "You're mid focus session — and you're doing great. Don't trade the streak for a scroll.",
      "The session you started is still running. Finish it and this feeling of pull will be gone."
    ],
    tough: [
      "You started a focus session. Finish what you started.",
      "Mid-session. No exceptions, no negotiations. Back to work."
    ],
    headline: "Focus session in progress."
  },
  adult: {
    kind: [
      "That content is filtered out. Not a judgment — a boundary you get to keep for free.",
      "This category stays closed. Your attention has better places to live."
    ],
    tough: [
      "Blocked category. Not negotiable, not unlockable.",
      "No. Go build something instead."
    ],
    headline: "That content stays closed."
  },
  blocklist: {
    kind: [
      "You put this site on your blocklist for a reason. The reason hasn't changed — only the urge has.",
      "Habit brought you here, not intention. Let's redirect that energy.",
      "This moment — right now — is where the new habit gets built. One closed tab at a time."
    ],
    tough: [
      "You blocked this yourself. Past-you doesn't trust this moment, and past-you was right.",
      "Muscle memory typed that URL. You don't actually want to be here.",
      "Nope. You have things to do and this isn't one of them."
    ],
    headline: "This isn't the way."
  }
};

const PHRASES = [
  "I am choosing distraction over my own goals right now",
  "This site matters more to me than my focus today",
  "I am trading my attention away with open eyes",
  "I accept that this break is a choice, not an accident",
  "My future self is watching me make this decision"
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

let dash = null;
let strict = { waitSeconds: 60, challenge: "phrase", maxUnlockMinutes: 15 };

async function init() {
  dash = await chrome.runtime.sendMessage({ type: "getDashboard" });
  const s = dash.settings;
  strict = s.strict;

  const tone = s.buddy?.tone === "tough" ? "tough" : "kind";
  const pack = LINES[reason] || LINES.blocklist;
  $("buddy-name").textContent = s.buddy?.enabled ? (s.buddy.name || "Nori") : "North";
  $("headline").textContent = pack.headline;
  $("subline").textContent = pack[tone][Math.floor(Math.random() * pack[tone].length)];

  // Meta pills: site, attempts today, time spent today
  const pills = [];
  if (site) pills.push(`<span class="pill"><strong>${esc(site)}</strong></span>`);
  if (reason === "keyword" && detail) pills.push(`<span class="pill">keyword: <strong>${esc(detail)}</strong></span>`);
  if (reason === "limit" && detail) pills.push(`<span class="pill">limit: <strong>${esc(detail)} min/day</strong></span>`);

  const blocksToday = site ? (dash.todayStats?.blocks?.[site] || 0) : 0;
  if (blocksToday > 1) pills.push(`<span class="pill"><strong>${blocksToday}</strong> visits stopped today</span>`);

  if (site) {
    const { seconds } = await chrome.runtime.sendMessage({ type: "getUsageFor", pattern: site });
    if (seconds > 60) pills.push(`<span class="pill"><strong>${Math.round(seconds / 60)}m</strong> here today</span>`);
  }
  $("meta").innerHTML = pills.join("");

  // "Somewhere better" destination — picked once per visit
  const places = s.betterPlaces || [];
  if (places.length) {
    betterPlace = places[Math.floor(Math.random() * places.length)];
    $("btn-back").textContent = betterPlace.label;
  }

  // Unlock availability
  if (reason === "shorts") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "Short-form content can't be unlocked — that's the whole point. A reel or short a friend sends you still opens (just that one).";
  } else if (reason === "adult") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "This category can't be unlocked.";
  } else if (dash.focus?.active) {
    $("btn-unlock").classList.add("hidden");
    const mins = Math.max(1, Math.ceil((dash.focus.until - Date.now()) / 60e3));
    $("footnote").textContent = `Focus session running — ${mins} min to go. Unlocks are paused until it ends.`;
  } else {
    $("footnote").textContent = `Unlocking takes a ${strict.waitSeconds}s wait and an honest sentence. By design.`;
  }
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

let betterPlace = null;

$("btn-back").addEventListener("click", () => {
  // Primary action: a genuinely better destination, picked at random from the
  // user's "somewhere better" list (configurable in settings).
  if (betterPlace?.url) {
    location.href = betterPlace.url;
    return;
  }
  // Fallback: back past the blocked redirect, else a blank page.
  if (history.length > 2) {
    history.go(-2);
    setTimeout(() => { location.href = "about:blank"; }, 400);
  } else {
    location.href = "about:blank";
  }
});

// --- Unlock flow ---

let waitTimer = null;
const CIRC = 2 * Math.PI * 52; // ring circumference

$("btn-unlock").addEventListener("click", () => {
  $("main-card").classList.add("hidden");
  $("unlock-card").classList.remove("hidden");
  startWait();
});

function startWait() {
  const total = Math.max(5, strict.waitSeconds || 60);
  let left = total;
  $("wait-total").textContent = total;
  $("ring-num").textContent = left;
  $("wait-note").classList.add("hidden");
  const fg = $("ring-fg");
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = 0;

  // The wait demands presence: leaving the tab or window restarts it.
  const restart = () => {
    left = total;
    $("ring-num").textContent = left;
    fg.style.strokeDashoffset = 0;
    $("wait-note").classList.remove("hidden");
  };
  waitOnLeave = () => { if (document.hidden) restart(); };
  waitOnBlur = () => restart();
  document.addEventListener("visibilitychange", waitOnLeave);
  window.addEventListener("blur", waitOnBlur);

  waitTimer = setInterval(() => {
    left -= 1;
    $("ring-num").textContent = left;
    fg.style.strokeDashoffset = CIRC * (1 - left / total);
    if (left <= 0) {
      stopWaitWatch();
      showChallenge();
    }
  }, 1000);
}

let waitOnLeave = null, waitOnBlur = null;

function stopWaitWatch() {
  clearInterval(waitTimer);
  if (waitOnLeave) document.removeEventListener("visibilitychange", waitOnLeave);
  if (waitOnBlur) window.removeEventListener("blur", waitOnBlur);
  waitOnLeave = waitOnBlur = null;
}

function cancelUnlock() {
  stopWaitWatch();
  $("unlock-card").classList.add("hidden");
  $("step-challenge").classList.add("hidden");
  $("step-wait").classList.remove("hidden");
  $("main-card").classList.remove("hidden");
  $("challenge-input").value = "";
  $("btn-confirm-unlock").disabled = true;
}

$("btn-cancel-wait").addEventListener("click", cancelUnlock);
$("btn-cancel-challenge").addEventListener("click", cancelUnlock);

// --- Challenge ---

let expected = "";

function showChallenge() {
  $("step-wait").classList.add("hidden");
  $("step-challenge").classList.remove("hidden");

  const mode = strict.challenge || "phrase";
  if (mode === "math") {
    const a = 12 + Math.floor(Math.random() * 78);
    const b = 12 + Math.floor(Math.random() * 78);
    expected = String(a * b);
    $("challenge-prompt").textContent = "Solve this to prove you're acting on purpose, not on autopilot:";
    $("challenge-phrase").textContent = `${a} × ${b} = ?`;
    $("challenge-input").placeholder = "Answer…";
  } else {
    expected = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    $("challenge-prompt").textContent = "Type this sentence exactly. If it doesn't feel true, close the tab instead.";
    $("challenge-phrase").textContent = expected;
    $("challenge-input").placeholder = "Type it exactly…";
  }
  $("challenge-input").focus();

  // Hide duration options above the strict max
  document.querySelectorAll("#durations .chip").forEach(c => {
    if (Number(c.dataset.mins) > (strict.maxUnlockMinutes || 15)) c.classList.add("hidden");
  });
}

$("challenge-input").addEventListener("input", e => {
  const ok = e.target.value.trim() === expected;
  $("btn-confirm-unlock").disabled = !ok;
  $("challenge-error").classList.toggle("hidden", ok || !e.target.value);
});

// Block paste — the sentence must be typed.
$("challenge-input").addEventListener("paste", e => e.preventDefault());
$("challenge-input").addEventListener("drop", e => e.preventDefault());

document.querySelectorAll("#durations .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#durations .chip").forEach(c => c.classList.remove("selected"));
    chip.classList.add("selected");
  });
});

$("btn-confirm-unlock").addEventListener("click", async () => {
  const mins = Number(document.querySelector("#durations .chip.selected")?.dataset.mins || 5);
  const res = await chrome.runtime.sendMessage({ type: "requestUnlock", domain: site, minutes: mins });
  if (res?.ok && fromUrl) {
    location.href = fromUrl;
  } else if (res?.error === "focus") {
    cancelUnlock();
    $("footnote").textContent = "A focus session is running — unlocks are paused.";
  }
});

init();
