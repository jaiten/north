// North — options dashboard logic

const $ = id => document.getElementById(id);
let S = null;        // settings (live copy)
let dash = null;

const FEEDBACK_EMAIL = "jaitenkangis@gmail.com";

const GATE_PHRASES = [
  "i am deliberately weakening the protection i asked for",
  "i choose convenience now over the goals i set",
  "i am overriding a promise i made to myself"
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function save() {
  await chrome.runtime.sendMessage({ type: "saveSettings", settings: S });
}

/**
 * Show a toast. Pass `action: { label, fn }` for a clickable follow-up;
 * action toasts stay up longer so they can actually be read and clicked.
 */
function toast(msg, action) {
  const t = $("toast");
  t.textContent = "";
  t.append(Object.assign(document.createElement("span"), { textContent: msg }));
  if (action) {
    const b = document.createElement("button");
    b.textContent = action.label;
    b.addEventListener("click", () => { t.classList.add("hidden"); action.fn(); });
    t.appendChild(b);
  }
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), action ? 10000 : 2600);
}

// ---------------------------------------------------------------------------
// Challenge gate: friction for protective changes
// ---------------------------------------------------------------------------

let gateTimer = null;
let gateApply = null;
const CIRC = 2 * Math.PI * 52;

/**
 * Run `apply` only after the wait + challenge (when strict mode is on).
 */
function gate(desc, apply) {
  if (!S.strict?.enabled) { apply(); return; }

  $("gate-desc").textContent = desc;
  $("gate-backdrop").classList.remove("hidden");
  $("gate-wait").classList.remove("hidden");
  $("gate-challenge").classList.add("hidden");
  $("gate-input").value = "";
  $("gate-error").classList.add("hidden");
  $("gate-note").classList.add("hidden");

  const total = Math.max(5, S.strict.waitSeconds || 60);
  let left = total;
  const fg = $("gate-ring-fg");
  $("gate-ring-num").textContent = left;
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = 0;

  startGateBreath();

  // The wait demands presence: leaving the tab, window or app restarts it.
  const restart = () => {
    left = total;
    $("gate-ring-num").textContent = left;
    fg.style.strokeDashoffset = 0;
    $("gate-note").classList.remove("hidden");
  };
  gateOnLeave = () => { if (document.hidden) restart(); };
  gateOnBlur = () => restart();
  document.addEventListener("visibilitychange", gateOnLeave);
  window.addEventListener("blur", gateOnBlur);

  clearInterval(gateTimer);
  gateTimer = setInterval(() => {
    left -= 1;
    $("gate-ring-num").textContent = left;
    fg.style.strokeDashoffset = CIRC * (1 - left / total);
    if (left <= 0) {
      stopGateWatch();
      showGateChallenge(apply);
    }
  }, 1000);
}

let gateOnLeave = null, gateOnBlur = null, gateBreathStop = null;

function startGateBreath() {
  const orb = $("gate-breath-orb");
  const label = $("gate-breath-label");
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
  gateBreathStop = () => { stopped = true; };
}

function stopGateWatch() {
  clearInterval(gateTimer);
  if (gateBreathStop) gateBreathStop();
  if (gateOnLeave) document.removeEventListener("visibilitychange", gateOnLeave);
  if (gateOnBlur) window.removeEventListener("blur", gateOnBlur);
  gateOnLeave = gateOnBlur = null;
}

let gateExpected = "";

function showGateChallenge(apply) {
  $("gate-wait").classList.add("hidden");
  $("gate-challenge").classList.remove("hidden");
  gateApply = apply;

  if (S.strict.challenge === "math") {
    const a = 12 + Math.floor(Math.random() * 78);
    const b = 12 + Math.floor(Math.random() * 78);
    gateExpected = String(a * b);
    $("gate-prompt").textContent = "solve this to confirm you're acting on purpose:";
    $("gate-phrase").textContent = `${a} × ${b} = ?`;
  } else {
    gateExpected = GATE_PHRASES[Math.floor(Math.random() * GATE_PHRASES.length)];
    $("gate-prompt").textContent = "type this sentence exactly. if it doesn't feel true, cancel.";
    $("gate-phrase").textContent = gateExpected;
  }
  $("gate-input").classList.remove("match");
  $("gate-confirm").classList.remove("ready");
  $("gate-input").focus();
}

const GATE_WRONG_LINES = [
  "that doesn't match yet. it has to be word for word.",
  "still not it. the sentence can tell when you're skimming.",
  "close, but the deal is the exact words.",
  "if it won't type, maybe it isn't true."
];
let gateWrongIdx = 0;

function submitGate() {
  if ($("gate-input").value.trim() !== gateExpected) {
    $("gate-error").textContent = GATE_WRONG_LINES[gateWrongIdx++ % GATE_WRONG_LINES.length];
    $("gate-error").classList.remove("hidden");
    $("gate-phrase").animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" },
       { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 380, easing: "ease-out" }
    );
    return;
  }
  closeGate();
  if (gateApply) gateApply();
}

function closeGate() {
  stopGateWatch();
  $("gate-backdrop").classList.add("hidden");
}

// Errors only show on submit, not while typing — but a correct answer goes
// green immediately, so you know the moment you've got it.
$("gate-input").addEventListener("input", e => {
  $("gate-error").classList.add("hidden");
  const ok = e.target.value.trim() === gateExpected;
  e.target.classList.toggle("match", ok);
  $("gate-confirm").classList.toggle("ready", ok);
});
$("gate-input").addEventListener("keydown", e => { if (e.key === "Enter") submitGate(); });
$("gate-input").addEventListener("paste", e => e.preventDefault());
$("gate-confirm").addEventListener("click", submitGate);
$("gate-cancel-wait").addEventListener("click", () => { closeGate(); render(); });
$("gate-cancel").addEventListener("click", () => { closeGate(); render(); });

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    $("sec-" + btn.dataset.section).classList.add("active");
    if (btn.dataset.section === "stats") renderStats();
  });
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function load() {
  dash = await chrome.runtime.sendMessage({ type: "getDashboard" });
  S = dash.settings;
  render();
  handleHash();
}

function render() {
  // Theme
  northApplyTheme(S.theme || "light");
  $("btn-theme").textContent = (S.theme || "light") === "light" ? "switch to dark" : "switch to light";

  // Master
  $("master-enabled").checked = S.enabled;
  $("master-label").textContent = S.enabled ? "protection on" : "protection OFF";

  // Shorts
  $("opt-shorts").checked = S.shorts.enabled;
  $("opt-tiktok").checked = S.shorts.blockTikTokEntirely;
  $("opt-shorts-shared").checked = S.shorts.allowSharedLinks;
  $("opt-mo-instagram").checked = !!S.messagesOnly?.instagram;
  $("opt-mo-linkedin").checked = !!S.messagesOnly?.linkedin;
  $("opt-mo-facebook").checked = !!S.messagesOnly?.facebook;
  $("opt-mo-x").checked = !!S.messagesOnly?.x;
  $("opt-yt-sidebar").checked = S.youtube.hideSidebar !== false;
  $("opt-yt-home").checked = S.youtube.hideHomeFeed;
  $("opt-yt-related").checked = S.youtube.hideRelated;
  $("opt-yt-comments").checked = S.youtube.hideComments;
  $("opt-yt-subs").checked = S.youtube.hideSubscriptions;
  $("opt-yt-topic").checked = S.youtube.topicMode;
  $("opt-li-tidy").checked = S.linkedin?.tidyNav !== false;
  $("opt-tw-clean").checked = S.twitch?.cleanHome !== false;

  // Buddy
  $("opt-buddy").checked = S.buddy.enabled;
  $("opt-buddy-name").value = S.buddy.name;
  $("tone-kind").classList.toggle("selected", S.buddy.tone !== "tough");
  $("tone-tough").classList.toggle("selected", S.buddy.tone === "tough");

  // Strict
  $("opt-strict").checked = S.strict.enabled;
  $("opt-wait").value = String(S.strict.waitSeconds);
  $("opt-challenge").value = ["math", "phrase"].includes(S.strict.challenge) ? S.strict.challenge : "journal";
  $("opt-max-unlock").value = String(S.strict.maxUnlockMinutes);

  renderSites();
  renderKeywords();
  renderBetterPlaces();
  renderLockdown();
}

function describeSite(site) {
  const dmNote = site.pattern === "instagram.com" ? ", DMs included" : "";
  if (site.mode === "always") return "blocked 24/7" + dmNote;
  if (site.mode === "limit") return `${site.limitMins} min/day budget`;
  if (site.mode === "schedule") {
    if (!site.schedule?.length) return "schedule with no windows yet (never blocked!)";
    const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return site.schedule.map(w =>
      `${(w.days || []).map(d => DAYS[d]).join("")} ${w.start}-${w.end}`).join(" · ");
  }
  return "";
}

function renderSites() {
  const list = $("site-list");
  if (!S.sites.length) {
    list.innerHTML = `<p class="hint">nothing blocked yet. add the sites that pull you in — the chips above are one click.</p>`;
    return;
  }
  list.innerHTML = S.sites.map(site => `
    <div class="site-row" data-id="${site.id}">
      <div class="site-fav">${esc(site.pattern[0])}</div>
      <div class="site-main">
        <div class="site-name">${esc(site.pattern)}</div>
        <div class="site-desc">${esc(describeSite(site))}</div>
      </div>
      <span class="site-badge ${site.mode}">${site.mode === "limit" ? "limit" : site.mode}</span>
      <button class="btn ghost small act-edit">edit</button>
      <button class="btn ghost small act-del" title="remove">✕</button>
    </div>`).join("");

  list.querySelectorAll(".act-edit").forEach(b =>
    b.addEventListener("click", e => openEditor(e.target.closest(".site-row").dataset.id)));
  list.querySelectorAll(".act-del").forEach(b =>
    b.addEventListener("click", e => {
      const id = e.target.closest(".site-row").dataset.id;
      const site = S.sites.find(s => s.id === id);
      const remove = async () => {
        S.sites = S.sites.filter(s => s.id !== id);
        await save();
        renderSites();
        toast(`${site.pattern} removed`);
      };
      // Just-added sites come off free — accidental clicks shouldn't cost a challenge.
      if (Date.now() < (graceUntil["site:" + id] || 0)) { remove(); return; }
      gate(`removing ${site.pattern} from your blocklist makes it fully accessible again.`, remove);
    }));
}

function normalizeSite(input) {
  let v = input.trim().toLowerCase();
  if (!v) return null;
  try { if (v.includes("://")) v = new URL(v).hostname; } catch {}
  v = v.replace(/^www\./, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return null;
  return v;
}

async function addSite(pattern) {
  const p = normalizeSite(pattern);
  if (!p) { toast("that doesn't look like a domain"); return; }
  if (S.sites.some(s => s.pattern === p)) { toast(`${p} is already on the list`); return; }
  const id = "s_" + Date.now().toString(36);
  S.sites.unshift({ id, pattern: p, mode: "always", schedule: [], limitMins: 30 });
  graceUntil["site:" + id] = Date.now() + SITE_GRACE_MS;
  await save();
  renderSites();

  // Blocking instagram.com takes the DMs down with it — people are often
  // surprised by that, so offer the messages-only mode right here.
  if (p === "instagram.com") {
    toast("Instagram is fully blocked — DMs included.", {
      label: "keep my DMs, block the rest",
      fn: async () => {
        S.sites = S.sites.filter(s => s.pattern !== "instagram.com");
        S.messagesOnly.instagram = true;
        await save();
        render();
        document.querySelector('.nav-item[data-section="social"]').click();
        toast("messages-only mode is on. DMs work, the feed doesn't.");
      }
    });
    return;
  }
  toast(`${p} blocked. misclick? removing it is free for ${SITE_GRACE_MS / 1000}s — after that it takes the ${S.strict?.waitSeconds || 60}s challenge.`);
}

$("btn-add-site").addEventListener("click", () => { addSite($("add-site-input").value); $("add-site-input").value = ""; });
$("add-site-input").addEventListener("keydown", e => {
  if (e.key === "Enter") { addSite(e.target.value); e.target.value = ""; }
});
document.querySelectorAll(".chip[data-site]").forEach(c =>
  c.addEventListener("click", () => addSite(c.dataset.site)));

// ---------------------------------------------------------------------------
// Site editor modal
// ---------------------------------------------------------------------------

let editing = null; // working copy

function openEditor(id) {
  const site = S.sites.find(s => s.id === id);
  editing = structuredClone(site);
  $("edit-title").textContent = `edit ${site.pattern}`;
  renderEditor();
  $("edit-backdrop").classList.remove("hidden");
}

function renderEditor() {
  document.querySelectorAll("#edit-modes .chip").forEach(c =>
    c.classList.toggle("selected", c.dataset.mode === editing.mode));
  $("edit-schedule").classList.toggle("hidden", editing.mode !== "schedule");
  $("edit-limit").classList.toggle("hidden", editing.mode !== "limit");
  $("edit-limit-mins").value = editing.limitMins || 30;
  renderWindows();
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function renderWindows() {
  const box = $("windows");
  box.innerHTML = "";
  (editing.schedule || []).forEach((w, i) => {
    const row = document.createElement("div");
    row.className = "window-row";
    const days = document.createElement("div");
    days.className = "days";
    DAY_LABELS.forEach((lbl, d) => {
      const b = document.createElement("button");
      b.className = "day-btn" + ((w.days || []).includes(d) ? " on" : "");
      b.textContent = lbl;
      b.onclick = () => {
        w.days = (w.days || []).includes(d) ? w.days.filter(x => x !== d) : [...(w.days || []), d];
        renderWindows();
      };
      days.appendChild(b);
    });
    const start = document.createElement("input");
    start.type = "time"; start.value = w.start || "09:00";
    start.onchange = () => { w.start = start.value; };
    const sep = document.createElement("span");
    sep.textContent = "to"; sep.style.color = "var(--text-faint)";
    const end = document.createElement("input");
    end.type = "time"; end.value = w.end || "17:00";
    end.onchange = () => { w.end = end.value; };
    const rm = document.createElement("button");
    rm.className = "rm"; rm.textContent = "✕";
    rm.onclick = () => { editing.schedule.splice(i, 1); renderWindows(); };
    row.append(days, start, sep, end, rm);
    box.appendChild(row);
  });
}

document.querySelectorAll("#edit-modes .chip").forEach(c =>
  c.addEventListener("click", () => { editing.mode = c.dataset.mode; renderEditor(); }));

$("btn-add-window").addEventListener("click", () => {
  editing.schedule = editing.schedule || [];
  editing.schedule.push({ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" });
  renderWindows();
});

$("edit-cancel").addEventListener("click", () => $("edit-backdrop").classList.add("hidden"));

$("edit-save").addEventListener("click", async () => {
  editing.limitMins = Math.max(1, Math.min(600, Number($("edit-limit-mins").value) || 30));
  const idx = S.sites.findIndex(s => s.id === editing.id);
  const old = S.sites[idx];

  const strictness = { always: 3, schedule: 2, limit: 1 };
  const weakening =
    strictness[editing.mode] < strictness[old.mode] ||
    (editing.mode === "limit" && old.mode === "limit" && editing.limitMins > old.limitMins) ||
    (editing.mode === "schedule" && old.mode === "schedule" &&
      JSON.stringify(editing.schedule) !== JSON.stringify(old.schedule));

  const commit = async () => {
    S.sites[idx] = editing;
    await save();
    $("edit-backdrop").classList.add("hidden");
    renderSites();
    toast("saved");
  };

  if (weakening) {
    $("edit-backdrop").classList.add("hidden");
    gate(`loosening the rules for ${old.pattern} gives the old habit a way back in.`, commit);
  } else {
    await commit();
  }
});

// ---------------------------------------------------------------------------
// Keywords & topics
// ---------------------------------------------------------------------------

function renderKeywords() {
  renderChipList("kw-chips", S.keywords, async i => {
    const kw = S.keywords[i];
    gate(`removing the keyword "${kw}" lets that content through everywhere.`, async () => {
      S.keywords.splice(i, 1);
      await save();
      renderKeywords();
    });
  });
  renderChipList("yt-kw-chips", S.youtube.titleKeywords, async i => {
    S.youtube.titleKeywords.splice(i, 1);
    await save();
    renderKeywords();
  });
  renderChipList("yt-topic-chips", S.youtube.allowedKeywords, async i => {
    S.youtube.allowedKeywords.splice(i, 1);
    await save();
    renderKeywords();
  });
}

function renderChipList(elId, arr, onRemove) {
  const box = $(elId);
  box.innerHTML = "";
  if (!arr.length) {
    box.innerHTML = `<span class="hint" style="margin:0">nothing here yet.</span>`;
    return;
  }
  arr.forEach((kw, i) => {
    const chip = document.createElement("span");
    chip.className = "kw-chip";
    chip.textContent = kw;
    const x = document.createElement("button");
    x.textContent = "✕";
    x.onclick = () => onRemove(i);
    chip.appendChild(x);
    box.appendChild(chip);
  });
}

async function addKeyword(inputId, arr) {
  const v = $(inputId).value.trim().toLowerCase();
  if (!v) return;
  if (v.length < 3) { toast("keywords under 3 characters would block half the internet"); return; }
  if (arr.includes(v)) { toast("already on the list"); return; }
  arr.push(v);
  $(inputId).value = "";
  await save();
  renderKeywords();
}

$("btn-add-kw").addEventListener("click", () => addKeyword("kw-input", S.keywords));
$("kw-input").addEventListener("keydown", e => { if (e.key === "Enter") addKeyword("kw-input", S.keywords); });
$("btn-yt-kw").addEventListener("click", () => addKeyword("yt-kw-input", S.youtube.titleKeywords));
$("yt-kw-input").addEventListener("keydown", e => { if (e.key === "Enter") addKeyword("yt-kw-input", S.youtube.titleKeywords); });
$("btn-yt-topic").addEventListener("click", () => addKeyword("yt-topic-input", S.youtube.allowedKeywords));
$("yt-topic-input").addEventListener("keydown", e => { if (e.key === "Enter") addKeyword("yt-topic-input", S.youtube.allowedKeywords); });

// ---------------------------------------------------------------------------
// Toggles. Protective ones go through the gate.
// ---------------------------------------------------------------------------

// Accidental clicks shouldn't cost a challenge: turning a protection ON
// starts a short grace window during which turning it back OFF is free.
// After that, off means the wait + challenge — and we say so up front.
const TOGGLE_GRACE_MS = 10000;
const SITE_GRACE_MS = 30000;
const graceUntil = {}; // toggle elId / "site:<id>" -> timestamp

function undoCostNote() {
  return S.strict?.enabled
    ? `undoing it later takes the ${S.strict.waitSeconds || 60}s challenge`
    : "strict mode is off, so you can undo it anytime";
}

function bindToggle(elId, get, set, weakenDesc) {
  $(elId).addEventListener("change", async e => {
    const turningOff = !e.target.checked && get();
    const inGrace = Date.now() < (graceUntil[elId] || 0);
    if (turningOff && weakenDesc && !inGrace) {
      e.target.checked = true; // revert until the gate passes
      gate(weakenDesc, async () => { set(false); await save(); render(); });
    } else {
      if (e.target.checked) {
        graceUntil[elId] = Date.now() + TOGGLE_GRACE_MS;
        if (weakenDesc) toast(`on. misclick? you've got ${TOGGLE_GRACE_MS / 1000}s to flip it back free — ${undoCostNote()}.`);
      } else {
        graceUntil[elId] = 0;
      }
      set(e.target.checked);
      await save();
      render();
    }
  });
}

bindToggle("master-enabled", () => S.enabled, v => { S.enabled = v; },
  "turning North off removes every block, limit and schedule at once.");
bindToggle("opt-shorts", () => S.shorts.enabled, v => { S.shorts.enabled = v; },
  "re-opening short videos invites the most addictive feeds back in.");
bindToggle("opt-tiktok", () => S.shorts.blockTikTokEntirely, v => { S.shorts.blockTikTokEntirely = v; },
  "unblocking TikTok opens an infinite short-video feed.");
bindToggle("opt-mo-instagram", () => S.messagesOnly.instagram, v => { S.messagesOnly.instagram = v; },
  "turning this off opens the full Instagram feed, Reels and Explore.");
bindToggle("opt-mo-linkedin", () => S.messagesOnly.linkedin, v => { S.messagesOnly.linkedin = v; },
  "turning this off brings the LinkedIn feed back.");
bindToggle("opt-mo-facebook", () => S.messagesOnly.facebook, v => { S.messagesOnly.facebook = v; },
  "turning this off opens the full Facebook feed, Watch and Marketplace.");
bindToggle("opt-mo-x", () => S.messagesOnly.x, v => { S.messagesOnly.x = v; },
  "turning this off brings the X timeline and trends back.");
bindToggle("opt-strict", () => S.strict.enabled, v => { S.strict.enabled = v; },
  "without strict mode, every protection can be switched off instantly.");

// Narrow allowance, no gate either way.
$("opt-shorts-shared").addEventListener("change", async e => {
  S.shorts.allowSharedLinks = e.target.checked;
  await save();
});

// YouTube / LinkedIn / Twitch cleanups are quality-of-life, no gate.
$("opt-yt-sidebar").addEventListener("change", async e => { S.youtube.hideSidebar = e.target.checked; await save(); });
$("opt-yt-home").addEventListener("change", async e => { S.youtube.hideHomeFeed = e.target.checked; await save(); });
$("opt-yt-related").addEventListener("change", async e => { S.youtube.hideRelated = e.target.checked; await save(); });
$("opt-yt-comments").addEventListener("change", async e => { S.youtube.hideComments = e.target.checked; await save(); });
$("opt-yt-subs").addEventListener("change", async e => { S.youtube.hideSubscriptions = e.target.checked; await save(); });
$("opt-yt-topic").addEventListener("change", async e => {
  S.youtube.topicMode = e.target.checked;
  await save();
  if (e.target.checked && !(S.youtube.allowedKeywords || []).length) {
    toast("add a few topics below or every video will be hidden");
  }
});
$("opt-li-tidy").addEventListener("change", async e => {
  S.linkedin = S.linkedin || {};
  S.linkedin.tidyNav = e.target.checked;
  await save();
});
$("opt-tw-clean").addEventListener("change", async e => {
  S.twitch = S.twitch || {};
  S.twitch.cleanHome = e.target.checked;
  await save();
});

// Theme toggle — cosmetic, no gate.
$("btn-theme").addEventListener("click", async () => {
  S.theme = (S.theme || "light") === "light" ? "dark" : "light";
  await save();
  render();
});

// Buddy
$("opt-buddy").addEventListener("change", async e => { S.buddy.enabled = e.target.checked; await save(); });
$("opt-buddy-name").addEventListener("change", async e => {
  S.buddy.name = e.target.value.trim() || "Nori";
  await save();
  toast(`${S.buddy.name} it is.`);
});
$("tone-kind").addEventListener("click", async () => { S.buddy.tone = "kind"; await save(); render(); });
$("tone-tough").addEventListener("click", async () => { S.buddy.tone = "tough"; await save(); render(); });

// Clicking the preview orb makes Nori say something else.
const PREVIEW_LINES = [
  '"every blocked tab is a small vote for the person you\'re becoming."',
  '"the feed misses you. don\'t text back."',
  '"i\'d wave, but i\'m a sphere."',
  '"you bring the goals. i\'ll bring the stubbornness."',
  '"north is up. i checked."'
];
let previewIdx = 0;
$("buddy-preview-orb").addEventListener("click", () => {
  previewIdx = (previewIdx + 1) % PREVIEW_LINES.length;
  $("buddy-preview-line").textContent = PREVIEW_LINES[previewIdx];
  $("buddy-preview-orb").animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
    { duration: 320, easing: "ease-out" }
  );
});

// Strict tuning. Lowering the wait or extending unlocks is a weakening.
$("opt-wait").addEventListener("change", async e => {
  const v = Number(e.target.value);
  if (v < S.strict.waitSeconds) {
    e.target.value = String(S.strict.waitSeconds);
    gate("a shorter wait makes impulsive unlocks easier.", async () => {
      S.strict.waitSeconds = v; await save(); render();
    });
  } else {
    S.strict.waitSeconds = v; await save();
  }
});
$("opt-challenge").addEventListener("change", async e => { S.strict.challenge = e.target.value; await save(); });
$("opt-max-unlock").addEventListener("change", async e => {
  const v = Number(e.target.value);
  if (v > S.strict.maxUnlockMinutes) {
    e.target.value = String(S.strict.maxUnlockMinutes);
    gate("longer unlocks mean longer detours.", async () => {
      S.strict.maxUnlockMinutes = v; await save(); render();
    });
  } else {
    S.strict.maxUnlockMinutes = v; await save();
  }
});

// ---------------------------------------------------------------------------
// Lockdown: allowlist-only mode with no off switch
// ---------------------------------------------------------------------------

let ldTicker = null;
let ldArmed = false;

function renderLockdown() {
  const live = dash.lockdown?.active && dash.lockdown.until > Date.now();
  $("lockdown-setup").classList.toggle("hidden", live);
  $("lockdown-live").classList.toggle("hidden", !live);

  renderChipList("ld-chips", S.lockdownAllow || [], async i => {
    S.lockdownAllow.splice(i, 1);
    await save();
    renderLockdown();
  });

  clearInterval(ldTicker);
  if (live) {
    const tick = () => {
      const left = Math.max(0, dash.lockdown.until - Date.now());
      const h = Math.floor(left / 3600e3);
      const m = Math.floor((left % 3600e3) / 60e3);
      const sec = Math.floor((left % 60e3) / 1000);
      $("ld-countdown").textContent = `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
      if (left <= 0) { clearInterval(ldTicker); load(); }
    };
    tick();
    ldTicker = setInterval(tick, 1000);
  }
}

$("btn-ld-add").addEventListener("click", async () => {
  const p = normalizeSite($("ld-input").value);
  if (!p) { toast("that doesn't look like a domain"); return; }
  S.lockdownAllow = S.lockdownAllow || [];
  if (S.lockdownAllow.includes(p)) { toast(`${p} is already on the allowlist`); return; }
  S.lockdownAllow.push(p);
  $("ld-input").value = "";
  await save();
  renderLockdown();
});
$("ld-input").addEventListener("keydown", e => { if (e.key === "Enter") $("btn-ld-add").click(); });

// Two-step start: arm, then commit. The arm state melts away after 6 seconds.
$("btn-ld-start").addEventListener("click", async () => {
  const mins = Number($("ld-duration").value);
  if (!(S.lockdownAllow || []).length) {
    toast("add at least one site to the allowlist first — or you'll lock out the entire internet.");
    return;
  }
  if (!ldArmed) {
    ldArmed = true;
    $("btn-ld-start").textContent = "click again to commit";
    $("btn-ld-start").classList.add("arm");
    setTimeout(() => {
      ldArmed = false;
      $("btn-ld-start").textContent = "start";
      $("btn-ld-start").classList.remove("arm");
    }, 6000);
    return;
  }
  await chrome.runtime.sendMessage({ type: "startLockdown", minutes: mins });
  ldArmed = false;
  $("btn-ld-start").textContent = "start";
  $("btn-ld-start").classList.remove("arm");
  await load();
  toast("lockdown started. see you on the other side.");
});

// ---------------------------------------------------------------------------
// "Take me somewhere better" destinations
// ---------------------------------------------------------------------------

function renderBetterPlaces() {
  const box = $("bp-list");
  const places = S.betterPlaces || [];
  box.innerHTML = "";
  if (!places.length) {
    box.innerHTML = `<p class="hint" style="margin:0">nowhere better yet. the block page will just send you back.</p>`;
    return;
  }
  places.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "bp-row";
    const label = document.createElement("span");
    label.className = "bp-label";
    label.textContent = p.label;
    const url = document.createElement("span");
    url.className = "bp-url";
    url.textContent = p.url;
    const rm = document.createElement("button");
    rm.className = "rm";
    rm.textContent = "✕";
    rm.onclick = async () => {
      S.betterPlaces.splice(i, 1);
      await save();
      renderBetterPlaces();
    };
    row.append(label, url, rm);
    box.appendChild(row);
  });
}

$("btn-add-bp").addEventListener("click", async () => {
  const label = $("bp-label").value.trim();
  let url = $("bp-url").value.trim();
  if (!label || !url) { toast("needs both a label and a URL"); return; }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); } catch { toast("that URL doesn't parse"); return; }
  S.betterPlaces = S.betterPlaces || [];
  S.betterPlaces.push({ label, url });
  $("bp-label").value = "";
  $("bp-url").value = "";
  await save();
  renderBetterPlaces();
});

// ---------------------------------------------------------------------------
// Backup & restore. Importing weaker settings goes through the gate.
// ---------------------------------------------------------------------------

function protectionScore(s) {
  let score = 0;
  if (s.enabled) score += 4;
  score += (s.sites?.length || 0);
  score += (s.keywords?.length || 0);
  if (s.shorts?.enabled) score += 3;
  if (s.adultBlock) score += 3;
  score += Object.values(s.messagesOnly || {}).filter(Boolean).length * 2;
  if (s.strict?.enabled) score += 3;
  score += Math.min(5, (s.strict?.waitSeconds || 0) / 60);
  return score;
}

$("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ north: 1, exportedAt: new Date().toISOString(), settings: S }, null, 2)],
    { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "north-settings.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("settings exported");
});

$("btn-import").addEventListener("click", () => $("import-file").click());

$("import-file").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("that file isn't valid JSON"); return; }
  const incoming = data?.settings;
  if (data?.north !== 1 || !incoming || typeof incoming !== "object" || !Array.isArray(incoming.sites)) {
    toast("that doesn't look like a North settings file");
    return;
  }
  const applyImport = async () => {
    S = incoming;
    await save();
    render();
    toast("settings imported");
  };
  if (protectionScore(incoming) < protectionScore(S)) {
    gate("the file you're importing is weaker than your current protection.", applyImport);
  } else {
    await applyImport();
  }
});

// ---------------------------------------------------------------------------
// Feature requests, by email
// ---------------------------------------------------------------------------

$("btn-feature").addEventListener("click", () => {
  const body = [
    "Hi, I'd like to request a feature for North:",
    "",
    "What I want:",
    "",
    "Why it would help me:",
    "",
    `(North v1.0, sent from the settings page)`
  ].join("\n");
  const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("North feature request")}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank");
});

// ---------------------------------------------------------------------------
// Incognito coverage prompt
// ---------------------------------------------------------------------------

function checkIncognito() {
  try {
    chrome.extension.isAllowedIncognitoAccess(allowed => {
      $("incognito-banner").classList.toggle("hidden", !!allowed);
    });
  } catch { /* not available outside the extension */ }
}

$("btn-incognito").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function renderStats() {
  const stats = dash.allStats || {};
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400e3);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, data: stats[key] });
  }

  let totalBlocks = 0, totalFocus = 0, totalUnlocks = 0;
  const siteCounts = {};
  for (const d of days) {
    if (!d.data) continue;
    totalFocus += d.data.focusMinutes || 0;
    totalUnlocks += d.data.unlocks || 0;
    for (const [site, n] of Object.entries(d.data.blocks || {})) {
      totalBlocks += n;
      siteCounts[site] = (siteCounts[site] || 0) + n;
    }
  }

  $("stats-summary").innerHTML = `
    <div class="stat"><div class="stat-num">${totalBlocks}</div><div class="stat-label">distractions dodged</div></div>
    <div class="stat"><div class="stat-num">${totalFocus >= 60 ? Math.round(totalFocus / 60) + "h" : totalFocus + "m"}</div><div class="stat-label">focused time</div></div>
    <div class="stat"><div class="stat-num">${totalUnlocks}</div><div class="stat-label">unlocks used</div></div>
    <div class="stat"><div class="stat-num">~${Math.round(totalBlocks * 7 / 60)}h</div><div class="stat-label">est. time reclaimed</div></div>`;

  const maxBlocks = Math.max(1, ...days.map(d =>
    Object.values(d.data?.blocks || {}).reduce((a, b) => a + b, 0)));
  $("chart-blocks").innerHTML = days.map(d => {
    const n = Object.values(d.data?.blocks || {}).reduce((a, b) => a + b, 0);
    return `<div class="bar-col" title="${d.label}: ${n} blocked">
      <div class="bar" style="height:${(n / maxBlocks) * 100}%"></div>
      <div class="bar-label">${d.label}</div></div>`;
  }).join("");

  const top = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $("top-blocked").innerHTML = top.length
    ? top.map(([site, n]) => `<div class="top-blocked-row"><span>${esc(site)}</span><span class="n">${n}×</span></div>`).join("")
    : `<p class="hint">no blocks recorded yet. either very good or very new.</p>`;

  // Unlock journal: your own reasons, read back to you.
  const journal = dash.journal || [];
  $("journal").innerHTML = journal.length
    ? journal.slice(0, 30).map(j => {
        const d = new Date(j.t);
        const when = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
        return `<div class="journal-row">
          <span class="journal-when">${when}</span>
          <span class="journal-site">${esc(j.site || "")}</span>
          <span class="journal-note">"${esc(j.note)}"</span>
        </div>`;
      }).join("")
    : `<p class="hint" style="margin:0">empty, and that's the best version of this page. every unlock you talk yourself through ends up here, in your own words.</p>`;
}

// ---------------------------------------------------------------------------
// Hash routing: #welcome onboarding, #gate=… from the popup
// ---------------------------------------------------------------------------

function handleHash() {
  if (location.hash === "#welcome") {
    history.replaceState(null, "", location.pathname);
    $("welcome-backdrop").classList.remove("hidden");
    return;
  }
  const m = location.hash.match(/gate=(\w+)/);
  if (!m) return;
  history.replaceState(null, "", location.pathname);
  if (m[1] === "disable") {
    gate("turning North off removes every block, limit and schedule at once.", async () => {
      S.enabled = false;
      await save();
      render();
      toast("protection off. Nori will be here when you're ready.");
    });
  }
  if (m[1] === "endFocus") {
    gate("ending the focus session early breaks the commitment you just made.", async () => {
      await chrome.runtime.sendMessage({ type: "endFocus" });
      toast("focus session ended.");
    });
  }
}

$("wel-apply").addEventListener("click", async () => {
  S.shorts.enabled = $("wel-shorts").checked;
  S.messagesOnly.instagram = $("wel-ig").checked;
  S.strict.enabled = $("wel-strict").checked;
  await save();
  render();
  $("welcome-backdrop").classList.add("hidden");
  toast("good start. now add the sites that pull you in.");
  $("add-site-input").focus();
});

load();
checkIncognito();
