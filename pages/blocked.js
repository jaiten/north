// North — blocked page logic

const params = new URLSearchParams(location.search);
const reason = params.get("reason") || "blocklist";
const site = params.get("site") || "";
const detail = params.get("detail") || "";
const fromUrl = params.get("from") || "";

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Buddy copy. Two tones per reason: gentle and direct. Plain words, no fluff.
// ---------------------------------------------------------------------------

const LINES = {
  shorts: {
    kind: [
      "Short videos are built to eat your time in 15 second bites. You had better plans for this hour.",
      "The algorithm wanted your next 40 minutes. I said no for you.",
      "Nothing in that feed will matter tomorrow. The thing you're avoiding probably will."
    ],
    tough: [
      "Shorts again? You know exactly how that ends.",
      "That feed is a slot machine. You're better than a slot machine.",
      "You didn't even want this. Your thumb did."
    ],
    headline: "Short videos stay closed."
  },
  instagram: {
    kind: [
      "Your messages still work. The feed can wait. It's designed to wait forever.",
      "I kept your DMs open in case someone real needs you. The rest is a rabbit hole."
    ],
    tough: [
      "Messages only. The feed is a trap with good lighting.",
      "If it's not a message from a real person, it can wait."
    ],
    headline: "Instagram is messages-only right now."
  },
  keyword: {
    kind: [
      "You asked me to keep this topic away from you. The you who wrote that rule was thinking clearly.",
      "This matched a keyword you blocked. Future you says thanks."
    ],
    tough: [
      "You wrote this keyword down as a no-go. Hold the line.",
      "Blocked by your own rule. Don't negotiate with yourself mid-craving."
    ],
    headline: "That topic is off limits."
  },
  schedule: {
    kind: [
      "This site is scheduled off right now. You set that schedule to protect this exact moment.",
      "It'll still be there when the window opens. Right now belongs to your real work."
    ],
    tough: [
      "These are blocked hours. You set them. Honor them.",
      "The clock says focus time. The site will survive without you."
    ],
    headline: "Not during these hours."
  },
  limit: {
    kind: [
      "You used your time here today, and that's fine. It was budgeted. Now the budget is spent.",
      "Today's allowance for this site is done. It resets at midnight."
    ],
    tough: [
      "Time's up. More scrolling won't find what the first 20 minutes didn't.",
      "Daily limit hit. The feed has no ending. Your day does."
    ],
    headline: "You've hit today's limit."
  },
  focus: {
    kind: [
      "You're in the middle of a focus session, and you're doing well. Don't trade that for a scroll.",
      "The session you started is still running. Finish it and this pull will be gone."
    ],
    tough: [
      "You started a focus session. Finish what you started.",
      "Mid-session. No exceptions. Back to work."
    ],
    headline: "Focus session in progress."
  },
  adult: {
    kind: [
      "That content is filtered out. Not a judgment, just a boundary you get to keep.",
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
      "You put this site on your blocklist for a reason. The reason hasn't changed. Only the urge has.",
      "Habit brought you here, not intention. Let's point that energy somewhere real.",
      "Right now is where the new habit gets built. One closed tab at a time."
    ],
    tough: [
      "You blocked this yourself. Past you doesn't trust this moment, and past you was right.",
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
let buddyTone = "kind";

async function init() {
  dash = await chrome.runtime.sendMessage({ type: "getDashboard" });
  const s = dash.settings;
  strict = s.strict;
  northApplyTheme(s.theme || "light");

  const tone = s.buddy?.tone === "tough" ? "tough" : "kind";
  buddyTone = tone;
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

  // Unlock availability
  if (reason === "shorts") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "Short videos can't be unlocked. That's the whole point. A reel or short a friend sends you still opens, just that one.";
  } else if (reason === "adult") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "This category can't be unlocked.";
  } else if (dash.focus?.active) {
    $("btn-unlock").classList.add("hidden");
    const mins = Math.max(1, Math.ceil((dash.focus.until - Date.now()) / 60e3));
    $("footnote").textContent = `Focus session running, ${mins} min to go. Unlocks are paused until it ends.`;
  } else {
    $("footnote").textContent = `Unlocking takes a ${strict.waitSeconds}s wait and an honest sentence. That's deliberate.`;
  }
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Poke Nori, get another line.
$("buddy-orb").addEventListener("click", () => {
  const pack = LINES[reason] || LINES.blocklist;
  const lines = pack[buddyTone];
  const current = $("subline").textContent;
  const others = lines.filter(l => l !== current);
  $("subline").textContent = others[Math.floor(Math.random() * others.length)] || current;
  $("buddy-orb").animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.16) rotate(-4deg)" }, { transform: "scale(1)" }],
    { duration: 340, easing: "ease-out" }
  );
});

// ---------------------------------------------------------------------------
// "Take me somewhere better": picked at random the moment you click.
// ---------------------------------------------------------------------------

$("btn-back").addEventListener("click", () => {
  const places = dash?.settings?.betterPlaces || [];
  if (places.length) {
    const p = places[Math.floor(Math.random() * places.length)];
    location.href = p.url;
    return;
  }
  if (history.length > 2) {
    history.go(-2);
    setTimeout(() => { location.href = "about:blank"; }, 400);
  } else {
    location.href = "about:blank";
  }
});

// ---------------------------------------------------------------------------
// Unlock flow
// ---------------------------------------------------------------------------

let waitTimer = null;
const CIRC = 2 * Math.PI * 52; // ring circumference

$("btn-unlock").addEventListener("click", () => {
  $("main-card").classList.add("hidden");
  $("unlock-card").classList.remove("hidden");
  startWait();
});

// --- Breathing guide: in 4s, hold 4s, out 6s. The point is presence. ---

let breathStop = null;

function startBreath() {
  const orb = $("breath-orb");
  const label = $("breath-label");
  let stopped = false;
  const phase = (text, anim, ms) => new Promise(res => {
    if (stopped) return res();
    label.textContent = text;
    if (anim) orb.animate(anim, { duration: ms, fill: "forwards", easing: "ease-in-out" });
    setTimeout(res, ms);
  });
  (async () => {
    while (!stopped) {
      await phase("Breathe in", [{ transform: "scale(0.55)", opacity: 0.55 }, { transform: "scale(1.05)", opacity: 1 }], 4000);
      await phase("Hold", null, 4000);
      await phase("Breathe out", [{ transform: "scale(1.05)", opacity: 1 }, { transform: "scale(0.55)", opacity: 0.55 }], 6000);
    }
  })();
  breathStop = () => { stopped = true; };
}

function startWait() {
  const total = Math.max(5, strict.waitSeconds || 60);
  let left = total;
  $("wait-total").textContent = total;
  $("ring-num").textContent = left;
  $("wait-note").classList.add("hidden");
  const fg = $("ring-fg");
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = 0;

  startBreath();

  // The wait demands presence: leaving the tab, the window or the app
  // restarts it from zero.
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
  if (breathStop) breathStop();
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
  $("challenge-error").classList.add("hidden");
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
    $("challenge-input").placeholder = "Answer, then press Enter";
  } else {
    expected = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    $("challenge-prompt").textContent = "Type this sentence exactly. If it doesn't feel true, close the tab instead.";
    $("challenge-phrase").textContent = expected;
    $("challenge-input").placeholder = "Type it, then press Enter";
  }
  $("challenge-input").focus();

  // Hide duration options above the strict max
  document.querySelectorAll("#durations .chip").forEach(c => {
    if (Number(c.dataset.mins) > (strict.maxUnlockMinutes || 15)) c.classList.add("hidden");
  });
}

// Errors only show on submit, not while typing.
$("challenge-input").addEventListener("input", () => {
  $("challenge-error").classList.add("hidden");
});
$("challenge-input").addEventListener("keydown", e => {
  if (e.key === "Enter") submitChallenge();
});

// The sentence must be typed, not pasted.
$("challenge-input").addEventListener("paste", e => e.preventDefault());
$("challenge-input").addEventListener("drop", e => e.preventDefault());

document.querySelectorAll("#durations .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#durations .chip").forEach(c => c.classList.remove("selected"));
    chip.classList.add("selected");
  });
});

async function submitChallenge() {
  if ($("challenge-input").value.trim() !== expected) {
    $("challenge-error").classList.remove("hidden");
    return;
  }
  const mins = Number(document.querySelector("#durations .chip.selected")?.dataset.mins || 5);
  const res = await chrome.runtime.sendMessage({ type: "requestUnlock", domain: site, minutes: mins });
  if (res?.ok && fromUrl) {
    location.href = fromUrl;
  } else if (res?.error === "focus") {
    cancelUnlock();
    $("footnote").textContent = "A focus session is running. Unlocks are paused.";
  }
}

$("btn-confirm-unlock").addEventListener("click", submitChallenge);

init();
