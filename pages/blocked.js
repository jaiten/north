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
      "short videos are built to eat your time in 15 second bites. you had better plans for this hour.",
      "the algorithm wanted your next 40 minutes. North said no for you.",
      "nothing in that feed will matter tomorrow. the thing you're avoiding probably will."
    ],
    tough: [
      "shorts again? you know exactly how that ends.",
      "that feed is a slot machine. you're better than a slot machine.",
      "you didn't even want this. your thumb did."
    ],
    headline: "short videos stay closed."
  },
  instagram: {
    kind: [
      "your messages still work. the feed can wait. it's designed to wait forever.",
      "your DMs are open in case someone real needs you. the rest is a rabbit hole."
    ],
    tough: [
      "messages only. the feed is a trap with good lighting.",
      "if it's not a message from a real person, it can wait."
    ],
    headline: "Instagram is messages-only right now."
  },
  dmonly: {
    kind: [
      "your messages still work. the feed doesn't, and honestly, it won't miss you.",
      "the conversations stay, the scroll is closed. real people get through. algorithms don't."
    ],
    tough: [
      "messages only. everything else on this site is bait.",
      "if a human wrote it to you, it's open. if a feed ranked it for you, it's not."
    ],
    headline: "this site is messages-only right now."
  },
  lockdown: {
    kind: [
      "lockdown is on. you chose a short list of places that matter, and this isn't one of them.",
      "you set this up in a clear-headed moment. North is just keeping the promise for you."
    ],
    tough: [
      "lockdown. your list, your rules, no exceptions.",
      "you knew this moment would come when you started the clock. hold."
    ],
    headline: "lockdown is on."
  },
  keyword: {
    kind: [
      "you asked me to keep this topic away from you. the you who wrote that rule was thinking clearly.",
      "this matched a keyword you blocked. future you says thanks."
    ],
    tough: [
      "you wrote this keyword down as a no-go. hold the line.",
      "blocked by your own rule. don't negotiate with yourself mid-craving."
    ],
    headline: "that topic is off limits."
  },
  schedule: {
    kind: [
      "this site is scheduled off right now. you set that schedule to protect this exact moment.",
      "it'll still be there when the window opens. right now belongs to your real work."
    ],
    tough: [
      "these are blocked hours. you set them. honor them.",
      "the clock says focus time. the site will survive without you."
    ],
    headline: "not during these hours."
  },
  limit: {
    kind: [
      "you used your time here today, and that's fine. it was budgeted. now the budget is spent.",
      "today's allowance for this site is done. it resets at midnight."
    ],
    tough: [
      "time's up. more scrolling won't find what the first 20 minutes didn't.",
      "daily limit hit. the feed has no ending. your day does."
    ],
    headline: "you've hit today's limit."
  },
  focus: {
    kind: [
      "you're mid focus session, and you're doing well. don't trade that for a scroll.",
      "the session you started is still running. finish it and this pull will be gone."
    ],
    tough: [
      "you started a focus session. finish what you started.",
      "mid-session. no exceptions. back to work."
    ],
    headline: "focus session in progress."
  },
  adult: {
    kind: [
      "that content is filtered out. not a judgment, just a boundary you get to keep.",
      "this category stays closed. your attention has better places to live."
    ],
    tough: [
      "blocked category. not negotiable, not unlockable.",
      "no. go build something instead."
    ],
    headline: "that content stays closed."
  },
  blocklist: {
    kind: [
      "you put this site on your blocklist for a reason. the reason hasn't changed. only the urge has.",
      "habit brought you here, not intention. let's point that energy somewhere real.",
      "right now is where the new habit gets built. one closed tab at a time."
    ],
    tough: [
      "you blocked this yourself. past you doesn't trust this moment, and past you was right.",
      "muscle memory typed that URL. you don't actually want to be here.",
      "nope. you have things to do and this isn't one of them."
    ],
    headline: "this isn't it."
  }
};

// Wrong-answer lines. Rotates so repeat misses don't feel canned.
const WRONG_LINES = {
  kind: [
    "not quite. it has to be word for word. take your time.",
    "close. but the deal is the exact sentence.",
    "almost. slow down and try once more.",
    "still not it. maybe that's a sign worth listening to."
  ],
  tough: [
    "wrong. type it like you mean it.",
    "not it. the sentence can tell when you're skimming.",
    "miss. again, word for word.",
    "if you can't even type it, you definitely shouldn't unlock it."
  ]
};
let wrongIdx = 0;

function shake(el) {
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
  "i am choosing distraction over my own goals right now",
  "this site matters more to me than my focus today",
  "i am trading my attention away with open eyes",
  "i accept that this break is a choice, not an accident",
  "my future self is watching me make this decision"
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
  if (reason === "lockdown") {
    $("btn-unlock").classList.add("hidden");
    const left = Math.max(1, Math.ceil((Number(detail) - Date.now()) / 60e3));
    const h = Math.floor(left / 60), m = left % 60;
    $("footnote").textContent = `lockdown ends in ${h ? h + "h " : ""}${m}m. no unlocks, no exceptions. that's the deal you made with yourself.`;
  } else if (reason === "shorts") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "short videos can't be unlocked. that's the whole point. a reel or short a friend sends you still opens, just that one.";
  } else if (reason === "adult") {
    $("btn-unlock").classList.add("hidden");
    $("footnote").textContent = "this category can't be unlocked.";
  } else if (dash.focus?.active) {
    $("btn-unlock").classList.add("hidden");
    const mins = Math.max(1, Math.ceil((dash.focus.until - Date.now()) / 60e3));
    $("footnote").textContent = `focus session running, ${mins} min to go. unlocks are paused until it ends.`;
  } else {
    $("footnote").textContent = `unlocking takes a ${strict.waitSeconds}s wait and a short journal entry. that's deliberate.`;
  }
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
// The cues vary cycle to cycle so it reads like a person pacing you, not a
// metronome.

const BREATH_CUES = {
  in:   ["breathe in", "in, slowly", "fill your lungs", "in through your nose", "another breath in"],
  hold: ["hold", "hold it there", "stay right here", "keep it", "hold. you're fine."],
  out:  ["breathe out", "let it all go", "out, slowly", "long exhale", "and release"]
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
    if (anim) orb.animate(anim, { duration: ms, fill: "forwards", easing: "ease-in-out" });
    setTimeout(res, ms);
  });
  (async () => {
    while (!stopped) {
      await phase(BREATH_CUES.in[cycle % BREATH_CUES.in.length],
        [{ transform: "scale(0.55)", opacity: 0.55 }, { transform: "scale(1.05)", opacity: 1 }], 4000);
      await phase(BREATH_CUES.hold[cycle % BREATH_CUES.hold.length], null, 4000);
      await phase(BREATH_CUES.out[cycle % BREATH_CUES.out.length],
        [{ transform: "scale(1.05)", opacity: 1 }, { transform: "scale(0.55)", opacity: 0.55 }], 6000);
      cycle++;
    }
  })();
  breathStop = () => { stopped = true; };
}

// Milestone notes under the ring, so the wait talks back a little.
function waitMilestone(left, total) {
  const p = left / total;
  if (left <= 5) return "almost. last few seconds.";
  if (p <= 0.25) return "nearly there. finish strong.";
  if (p <= 0.5) return "halfway. still here, still breathing.";
  if (p <= 0.75) return "good. eyes on the circle.";
  return "stay on this page. the timer only runs while you're here.";
}

function startWait() {
  const total = Math.max(5, strict.waitSeconds || 60);
  let left = total;
  $("wait-total").textContent = total;
  $("ring-num").textContent = left;
  $("wait-note").classList.add("hidden");
  $("stay-hint").textContent = waitMilestone(left, total);
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
    // Belt and braces: blur can fail to fire (embedded views, devtools), but
    // hasFocus() can't lie. No focus, no countdown.
    if (document.hidden || !document.hasFocus()) { restart(); return; }
    left -= 1;
    $("ring-num").textContent = left;
    $("stay-hint").textContent = waitMilestone(left, total);
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
    $("challenge-prompt").textContent = "solve this first, then tell future you why you're here:";
    $("challenge-phrase").textContent = `${a} × ${b} = ?`;
    $("challenge-input").placeholder = "answer";
  } else if (mode === "phrase") {
    expected = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    $("extra-challenge").classList.remove("hidden");
    $("challenge-prompt").textContent = "type this sentence exactly, then tell future you why you're here:";
    $("challenge-phrase").textContent = expected;
    $("challenge-input").placeholder = "type it here";
  } else {
    expected = null;
    $("extra-challenge").classList.add("hidden");
    $("challenge-prompt").textContent =
      `write future you a note about why you need this, at least ${MIN_WORDS} words. if you can't fill ${MIN_WORDS} words, you probably don't need it.`;
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
    : n >= MIN_WORDS ? `${n} words, make them real ones`
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
      ? `that's ${words} word${words === 1 ? "" : "s"}. the deal is ${MIN_WORDS} honest ones. keep going.`
      : "that doesn't read like a real reason yet. write it like you'd explain it to a friend.",
      $("challenge-why"));
    return;
  }
  const mins = Number(document.querySelector("#durations .chip.selected")?.dataset.mins || 5);
  const res = await chrome.runtime.sendMessage({ type: "requestUnlock", domain: site, minutes: mins, note });
  if (res?.ok && fromUrl) {
    location.href = fromUrl;
  } else if (res?.error === "note") {
    challengeFail("that doesn't read like a real reason yet. write it like you'd explain it to a friend.", $("challenge-why"));
  } else if (res?.error === "focus") {
    cancelUnlock();
    $("footnote").textContent = "a focus session is running. unlocks are paused.";
  }
}

$("btn-confirm-unlock").addEventListener("click", submitChallenge);

init();
