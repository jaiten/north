// North — blocked page logic

const params = new URLSearchParams(location.search);
const reason = params.get("reason") || "blocklist";
const site = params.get("site") || "";
const detail = params.get("detail") || "";
const fromUrl = params.get("from") || "";

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Block-page copy. Two tones per reason: gentle and direct. Plain words.
// ---------------------------------------------------------------------------

const LINES = {
  shorts: {
    kind: [
      "Short videos are engineered to take your time fifteen seconds at a time. You had better plans for this hour.",
      "The feed was ready to spend your next forty minutes. North declined on your behalf.",
      "Nothing in that feed will matter tomorrow. The thing you're avoiding probably will."
    ],
    tough: [
      "You already know how this ends. It ends an hour from now.",
      "That feed is designed to be unwinnable. The only move is not to open it.",
      "This wasn't a decision. It was a reflex."
    ],
    headline: "Short videos stay closed."
  },
  instagram: {
    kind: [
      "Your messages still work. The feed can wait, and it's built to wait indefinitely.",
      "Your DMs are open in case someone needs you. The rest is a detour."
    ],
    tough: [
      "Messages only. The feed is bait with good lighting.",
      "If it isn't a message from a real person, it can wait."
    ],
    headline: "Instagram is in messages-only mode."
  },
  dmonly: {
    kind: [
      "Your messages still work. The feed doesn't, and it won't miss you.",
      "Conversations stay open. The scroll is closed. People get through; algorithms don't."
    ],
    tough: [
      "Messages only. Everything else on this site is designed to keep you here.",
      "If a person wrote it to you, it's open. If a feed ranked it for you, it isn't."
    ],
    headline: "This site is in messages-only mode."
  },
  lockdown: {
    kind: [
      "Lockdown is active. You chose a short list of sites that matter, and this isn't one of them.",
      "You set this up in a clear-headed moment. North is keeping that commitment for you."
    ],
    tough: [
      "Lockdown is active. Your list, your rules, no exceptions.",
      "You knew this moment would come when you started the clock. Hold."
    ],
    headline: "Lockdown is active."
  },
  keyword: {
    kind: [
      "You asked North to keep this topic away from you. That was a considered decision.",
      "This page matched a keyword you blocked. Your future self will be glad it held."
    ],
    tough: [
      "You wrote this keyword down as off limits. Hold the line.",
      "Blocked by your own rule. Don't renegotiate it mid-urge."
    ],
    headline: "That topic is off limits."
  },
  schedule: {
    kind: [
      "This site is scheduled off right now. You set that schedule to protect exactly this moment.",
      "It will still be here when the window opens. Right now belongs to your work."
    ],
    tough: [
      "These are blocked hours. You set them. Honour them.",
      "The schedule says focus. The site will manage without you."
    ],
    headline: "Not during these hours."
  },
  limit: {
    kind: [
      "You've used your time here today, and that's fine. It was budgeted, and the budget is spent.",
      "Today's allowance for this site is done. It resets at midnight."
    ],
    tough: [
      "Time's up. More scrolling won't find what the first twenty minutes didn't.",
      "Daily limit reached. The feed has no ending. Your day does."
    ],
    headline: "You've reached today's limit."
  },
  focus: {
    kind: [
      "You're mid focus session and it's going well. Don't trade that for a scroll.",
      "The session you started is still running. Finish it, and this pull will have passed."
    ],
    tough: [
      "You started a focus session. Finish what you started.",
      "Mid-session. No exceptions until it ends."
    ],
    headline: "Focus session in progress."
  },
  adult: {
    kind: [
      "This content is filtered out. Not a judgment, just a boundary you get to keep.",
      "This category stays closed. Your attention has better places to be."
    ],
    tough: [
      "Blocked category. Not negotiable, not unlockable.",
      "This one has no unlock path, by design."
    ],
    headline: "That content stays closed."
  },
  blocklist: {
    kind: [
      "You made a little space for yourself by closing this site. Take a breath. Your time is still yours.",
      "A familiar detour. A moment to choose where you want your attention to go next.",
      "The feed will still be here. For now, there’s room for something that matters to you."
    ],
    tough: [
      "You blocked this yourself. Past you didn't trust this moment, and past you had a point.",
      "Muscle memory typed that address. You didn't actually choose to be here.",
      "Not now. You have things to do, and this isn't one of them."
    ],
    headline: "This site is blocked."
  }
};

// Wrong-answer lines. Rotates so repeat misses don't feel canned.
const WRONG_LINES = {
  kind: [
    "Not quite. It has to be word for word. Take your time.",
    "Close. The deal is the exact sentence.",
    "Almost. Slow down and try once more.",
    "Still not it. That may be worth listening to."
  ],
  tough: [
    "Not a match. Type it properly.",
    "Not it. The sentence can tell when you're skimming.",
    "Miss. Again, word for word.",
    "If it's hard to type, it's probably not worth unlocking."
  ]
};
let wrongIdx = 0;

function shake(el) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" },
     { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
    { duration: 380, easing: "ease-out" }
  );
}

function linePack() {
  if (reason === "dmonly" && site.includes("instagram")) return LINES.instagram;
  return LINES[reason] || LINES.blocklist;
}

const PHRASES = [
  "I am choosing distraction over the goals I set for myself",
  "This site matters more to me than my focus does today",
  "I am trading my attention away with my eyes open",
  "I accept that this break is a choice, not an accident",
  "I am making this decision on behalf of my future self"
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
  const pack = linePack();

  $("headline").textContent = pack.headline;
  $("subline").textContent = pack[tone][Math.floor(Math.random() * pack[tone].length)];

  // Meta pills: site, attempts today, time spent today
  const pills = [];
  if (site) pills.push(`<span class="pill"><strong>${esc(site)}</strong></span>`);
  if (reason === "keyword" && detail) pills.push(`<span class="pill">Keyword: <strong>${esc(detail)}</strong></span>`);
  if (reason === "limit" && detail) pills.push(`<span class="pill">Limit: <strong>${esc(detail)} min/day</strong></span>`);

  const blocksToday = site ? (dash.todayStats?.blocks?.[site] || 0) : 0;
  if (blocksToday > 1) pills.push(`<span class="pill"><strong>${blocksToday}</strong> visits stopped today</span>`);

  if (site) {
    const { seconds } = await chrome.runtime.sendMessage({ type: "getUsageFor", pattern: site });
    if (seconds > 60) pills.push(`<span class="pill"><strong>${Math.round(seconds / 60)}m</strong> spent here today</span>`);
  }
  $("meta").innerHTML = pills.join("");

  // Messages-only blocks leave a door open: a misclick onto the feed shouldn't
  // strand you. Offer a one-tap return to the part you're still allowed to use
  // (the inbox), passed through as `detail`.
  if (reason === "dmonly" && /^https?:\/\//.test(detail)) {
    $("btn-allowed").classList.remove("hidden");
    // the inbox is the natural primary action here; demote "somewhere better".
    $("btn-back").classList.replace("primary", "ghost");
  }

  // Unlock availability
  if (reason === "lockdown") {
    $("btn-unlock").classList.add("hidden");
    const left = Math.max(1, Math.ceil((Number(detail) - Date.now()) / 60e3));
    const h = Math.floor(left / 60), m = left % 60;
    $("footnote").textContent = `Lockdown ends in ${h ? h + "h " : ""}${m}m. No unlocks, no exceptions — that was the commitment.`;
  } else if (reason === "shorts") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "Short videos can't be unlocked; that's the point. A reel or short someone sends you still opens — just that one.";
  } else if (reason === "adult") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "This category can't be unlocked.";
  } else if (dash.focus?.active) {
    $("btn-unlock").classList.add("hidden");
    const mins = Math.max(1, Math.ceil((dash.focus.until - Date.now()) / 60e3));
    $("footnote").textContent = `Focus session running, ${mins} min remaining. Unlocks are paused until it ends.`;
  } else {
    $("footnote").textContent = `Unlocking takes a ${formatWait(strict.waitSeconds)} wait and a short journal entry. That's deliberate.`;
  }
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** "45 second" / "1 minute" / "1 min 30 sec" / "2 minute" — reads inside a sentence. */
function formatWait(sec) {
  const n = Math.max(5, Number(sec) || 60);
  if (n < 60) return `${n} second`;
  const m = Math.floor(n / 60), r = n % 60;
  if (!r) return m === 1 ? "one minute" : `${m} minute`;
  return `${m} min ${r} sec`;
}

// Click the headline for another line, if this one didn't land.
$("subline").addEventListener("click", () => {
  const lines = linePack()[buddyTone];
  const current = $("subline").textContent;
  const others = lines.filter(l => l !== current);
  $("subline").textContent = others[Math.floor(Math.random() * others.length)] || current;
});

// ---------------------------------------------------------------------------
// "Take me somewhere better": picked at random the moment you click.
// ---------------------------------------------------------------------------

// Messages-only escape hatch: jump straight to the inbox (the allowed area).
$("btn-allowed").addEventListener("click", () => {
  if (/^https?:\/\//.test(detail)) location.href = detail;
});

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

let waitFrame = null;
const CIRC = 2 * Math.PI * 52; // ring circumference

$("btn-unlock").addEventListener("click", () => {
  $("main-card").classList.add("hidden");
  $("unlock-card").classList.remove("hidden");
  startWait();
});

// --- Breathing guide: in 4s, hold 4s, out 6s. The point is presence. ---
// The cues vary cycle to cycle so it reads like a person pacing you, not a
// metronome.

const BREATH_CUES = {
  in:   ["Breathe in", "In, slowly", "Fill your lungs", "In through your nose", "Another breath in"],
  hold: ["Hold", "Hold it there", "Stay with it", "Keep it", "Hold, you're fine"],
  out:  ["Breathe out", "Let it go", "Out, slowly", "Long exhale", "And release"]
};

let breathStop = null;

function startBreath() {
  const orb = $("breath-orb");
  const label = $("breath-label");
  let stopped = false;
  let cycle = 0;
  const phase = (text, anim, ms) => new Promise(res => {
    if (stopped) return res();
    label.textContent = text;
    if (anim && !matchMedia('(prefers-reduced-motion: reduce)').matches) orb.animate(anim, { duration: ms, fill: "forwards", easing: "ease-in-out" });
    setTimeout(res, ms);
  });
  (async () => {
    while (!stopped) {
      await phase(BREATH_CUES.in[cycle % BREATH_CUES.in.length],
        [{ transform: "scale(0.55)", opacity: 0.8 }, { transform: "scale(1.05)", opacity: 1 }], 4000);
      await phase(BREATH_CUES.hold[cycle % BREATH_CUES.hold.length], null, 4000);
      await phase(BREATH_CUES.out[cycle % BREATH_CUES.out.length],
        [{ transform: "scale(1.05)", opacity: 1 }, { transform: "scale(0.55)", opacity: 0.8 }], 6000);
      cycle++;
    }
  })();
  breathStop = () => { stopped = true; };
}

// Milestone notes under the ring, so the wait talks back a little.
function waitMilestone(left, total) {
  const p = left / total;
  if (left <= 5) return "Almost there. A few seconds left.";
  if (p <= 0.25) return "Nearly done. Finish it out.";
  if (p <= 0.5) return "Halfway. Still here, still breathing.";
  if (p <= 0.75) return "Good. Keep your eyes on the circle.";
  return "The timer only counts while this page is in front of you.";
}

// The ring is drawn from a deadline on every animation frame, so it drains at a
// constant rate instead of stepping once a second. The digit still reads in
// whole seconds — it just isn't what drives the motion.
function startWait() {
  const total = Math.max(5, strict.waitSeconds || 60);
  let deadline = Date.now() + total * 1000;
  let shownSec = null;
  $("wait-total").textContent = total;
  $("wait-note").classList.add("hidden");
  const fg = $("ring-fg");
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = 0;

  startBreath();

  // The wait demands presence: leaving the tab, the window or the app
  // restarts it from zero.
  const restart = () => {
    deadline = Date.now() + total * 1000;
    $("wait-note").classList.remove("hidden");
  };
  waitOnLeave = () => { if (document.hidden) restart(); };
  waitOnBlur = () => restart();
  document.addEventListener("visibilitychange", waitOnLeave);
  window.addEventListener("blur", waitOnBlur);

  const frame = () => {
    // Belt and braces: blur can fail to fire (embedded views, devtools), but
    // hasFocus() can't lie. No focus, no countdown.
    if (document.hidden || !document.hasFocus()) restart();
    const left = Math.max(0, (deadline - Date.now()) / 1000);
    fg.style.strokeDashoffset = CIRC * (1 - left / total);
    const sec = Math.ceil(left);
    if (sec !== shownSec) {
      shownSec = sec;
      $("ring-num").textContent = sec;
      $("stay-hint").textContent = waitMilestone(sec, total);
    }
    if (left <= 0) {
      stopWaitWatch();
      showChallenge();
      return;
    }
    waitFrame = requestAnimationFrame(frame);
  };
  frame();
}

let waitOnLeave = null, waitOnBlur = null;

function stopWaitWatch() {
  if (waitFrame) cancelAnimationFrame(waitFrame);
  waitFrame = null;
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
  $("challenge-why").value = "";
  $("challenge-error").classList.add("hidden");
  updateReady();
}

$("btn-cancel-wait").addEventListener("click", cancelUnlock);
$("btn-cancel-challenge").addEventListener("click", cancelUnlock);

// --- Challenge: the journal entry is the main event ---------------------
// You write to future you about why you need this, in at least MIN_WORDS
// real words. Phrase / math are optional extras on top (set in strictness).

const MIN_WORDS = 20;
let expected = null; // typed phrase/math answer, when that extra is on

// Same bar the background worker enforces: enough words, mostly distinct,
// and not keyboard mash.
function journalWords(note) {
  return String(note || "").toLowerCase().split(/\s+/).filter(w => /[a-z]/i.test(w));
}
function journalNoteOk(note) {
  const words = journalWords(note);
  if (words.length < MIN_WORDS) return false;
  if (new Set(words).size < MIN_WORDS / 2) return false;
  const withVowels = words.filter(w => /[aeiouy]/i.test(w)).length;
  return withVowels >= words.length * 0.7;
}

function showChallenge() {
  $("step-wait").classList.add("hidden");
  $("step-challenge").classList.remove("hidden");

  const mode = strict.challenge || "journal";
  if (mode === "math") {
    const a = 12 + Math.floor(Math.random() * 78);
    const b = 12 + Math.floor(Math.random() * 78);
    expected = String(a * b);
    $("extra-challenge").classList.remove("hidden");
    $("challenge-prompt").textContent = "Solve this first, then tell your future self why you're here.";
    $("challenge-phrase").textContent = `${a} × ${b} = ?`;
    $("challenge-input").placeholder = "Answer";
  } else if (mode === "phrase") {
    expected = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    $("extra-challenge").classList.remove("hidden");
    $("challenge-prompt").textContent = "Type this sentence exactly, then tell your future self why you're here.";
    $("challenge-phrase").textContent = expected;
    $("challenge-input").placeholder = "Type it here";
  } else {
    expected = null;
    $("extra-challenge").classList.add("hidden");
    $("challenge-prompt").textContent =
      `Leave your future self a note in at least ${MIN_WORDS} words: what you came to do, and when you plan to leave.`;
  }
  (expected ? $("challenge-input") : $("challenge-why")).focus();
  updateReady();

  // Hide duration options above the strict max
  document.querySelectorAll("#durations .chip").forEach(c => {
    if (Number(c.dataset.mins) > (strict.maxUnlockMinutes || 15)) c.classList.add("hidden");
  });
}

// Live feedback: the typed answer goes green the moment it matches, the word
// counter fills up, and the unlock button goes green when the whole case is
// made. No surprises on submit.
function updateReady() {
  const phraseOk = !expected || $("challenge-input").value.trim() === expected;
  const noteOk = journalNoteOk($("challenge-why").value);
  $("challenge-input").classList.toggle("match", !!expected && phraseOk);

  const n = journalWords($("challenge-why").value).length;
  const counter = $("word-count");
  counter.textContent = noteOk ? `${n} words ✓`
    : n >= MIN_WORDS ? `${n} words — make them real ones`
    : `${n} / ${MIN_WORDS} words`;
  counter.classList.toggle("done", noteOk);

  $("btn-confirm-unlock").classList.toggle("ready", phraseOk && noteOk);
}

// Errors only show on submit, not while typing.
$("challenge-input").addEventListener("input", () => {
  $("challenge-error").classList.add("hidden");
  updateReady();
});
$("challenge-input").addEventListener("keydown", e => {
  if (e.key === "Enter") $("challenge-why").focus();
});
$("challenge-why").addEventListener("input", () => {
  $("challenge-error").classList.add("hidden");
  updateReady();
});

// The sentence and the journal must be typed, not pasted.
$("challenge-input").addEventListener("paste", e => e.preventDefault());
$("challenge-input").addEventListener("drop", e => e.preventDefault());
$("challenge-why").addEventListener("paste", e => e.preventDefault());
$("challenge-why").addEventListener("drop", e => e.preventDefault());

document.querySelectorAll("#durations .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#durations .chip").forEach(c => c.classList.remove("selected"));
    chip.classList.add("selected");
  });
});

function challengeFail(msg, focusEl) {
  $("challenge-error").textContent = msg;
  $("challenge-error").classList.remove("hidden");
  if (focusEl) { shake(focusEl); focusEl.focus(); }
}

async function submitChallenge() {
  if (expected && $("challenge-input").value.trim() !== expected) {
    challengeFail(WRONG_LINES[buddyTone][wrongIdx++ % WRONG_LINES[buddyTone].length], $("challenge-input"));
    return;
  }
  const note = $("challenge-why").value.trim();
  if (!journalNoteOk(note)) {
    const words = journalWords(note).length;
    challengeFail(words < MIN_WORDS
      ? `That's ${words} word${words === 1 ? "" : "s"}. The deal is ${MIN_WORDS} honest ones. Keep going.`
      : "That doesn't read like a real reason yet. Write it the way you'd explain it to a friend.",
      $("challenge-why"));
    return;
  }
  const mins = Number(document.querySelector("#durations .chip.selected")?.dataset.mins || 5);
  const res = await chrome.runtime.sendMessage({ type: "requestUnlock", domain: site, minutes: mins, note });
  if (res?.ok && fromUrl) {
    location.href = fromUrl;
  } else if (res?.error === "note") {
    challengeFail("That doesn't read like a real reason yet. Write it the way you'd explain it to a friend.", $("challenge-why"));
  } else if (res?.error === "focus") {
    cancelUnlock();
    $("footnote").textContent = "A focus session is running. Unlocks are paused.";
  }
}

$("btn-confirm-unlock").addEventListener("click", submitChallenge);

// If protection gets paused while you're sitting on this page, the page has no
// reason to exist any more — go on to what you were opening. Adult content,
// lockdowns and focus sessions are never paused, so they stay put rather than
// bouncing straight back here.
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.pause) return;
    if (["adult", "lockdown", "focus"].includes(reason)) return;
    const until = changes.pause.newValue?.until || 0;
    if (until > Date.now() && /^https?:\/\//.test(fromUrl)) location.href = fromUrl;
  });
} catch { /* preview environment */ }

init();
