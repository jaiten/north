// North — options dashboard logic

const $ = id => document.getElementById(id);
let S = null;        // settings (live copy)
let dash = null;

const FEEDBACK_EMAIL = "jaitenkangis@gmail.com";

const GATE_PHRASES = [
  "I am deliberately weakening the protection I asked for",
  "I choose convenience now over the goals I set",
  "I am overriding a promise I made to myself"
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
    $("gate-prompt").textContent = "Solve this to confirm you're acting on purpose:";
    $("gate-phrase").textContent = `${a} × ${b} = ?`;
  } else {
    gateExpected = GATE_PHRASES[Math.floor(Math.random() * GATE_PHRASES.length)];
    $("gate-prompt").textContent = "Type this sentence exactly. If it doesn't feel true, cancel.";
    $("gate-phrase").textContent = gateExpected;
  }
  $("gate-input").focus();
}

function submitGate() {
  if ($("gate-input").value.trim() !== gateExpected) {
    $("gate-error").classList.remove("hidden");
    return;
  }
  closeGate();
  if (gateApply) gateApply();
}

function closeGate() {
  stopGateWatch();
  $("gate-backdrop").classList.add("hidden");
}

// Errors only show on submit, not while typing.
$("gate-input").addEventListener("input", () => $("gate-error").classList.add("hidden"));
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
  $("btn-theme").textContent = (S.theme || "light") === "light" ? "Switch to dark" : "Switch to light";

  // Master
  $("master-enabled").checked = S.enabled;
  $("master-label").textContent = S.enabled ? "Protection on" : "Protection OFF";

  // Shorts
  $("opt-shorts").checked = S.shorts.enabled;
  $("opt-tiktok").checked = S.shorts.blockTikTokEntirely;
  $("opt-shorts-shared").checked = S.shorts.allowSharedLinks;
  $("opt-ig-dm").checked = S.instagramDmOnly;
  $("opt-yt-home").checked = S.youtube.hideHomeFeed;
  $("opt-yt-related").checked = S.youtube.hideRelated;
  $("opt-yt-comments").checked = S.youtube.hideComments;
  $("opt-yt-subs").checked = S.youtube.hideSubscriptions;
  $("opt-yt-topic").checked = S.youtube.topicMode;

  // Buddy
  $("opt-buddy").checked = S.buddy.enabled;
  $("opt-buddy-name").value = S.buddy.name;
  $("tone-kind").classList.toggle("selected", S.buddy.tone !== "tough");
  $("tone-tough").classList.toggle("selected", S.buddy.tone === "tough");

  // Strict
  $("opt-strict").checked = S.strict.enabled;
  $("opt-wait").value = String(S.strict.waitSeconds);
  $("opt-challenge").value = S.strict.challenge === "math" ? "math" : "phrase";
  $("opt-max-unlock").value = String(S.strict.maxUnlockMinutes);

  renderSites();
  renderKeywords();
  renderBetterPlaces();
}

function describeSite(site) {
  const dmNote = site.pattern === "instagram.com" ? ", DMs included" : "";
  if (site.mode === "always") return "Blocked 24/7" + dmNote;
  if (site.mode === "limit") return `${site.limitMins} min/day budget`;
  if (site.mode === "schedule") {
    if (!site.schedule?.length) return "Schedule with no windows yet (never blocked!)";
    const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return site.schedule.map(w =>
      `${(w.days || []).map(d => DAYS[d]).join("")} ${w.start}-${w.end}`).join(" · ");
  }
  return "";
}

function renderSites() {
  const list = $("site-list");
  if (!S.sites.length) {
    list.innerHTML = `<p class="hint">Nothing blocked yet. Add the sites that pull you in. The chips above are one click.</p>`;
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
      <button class="btn ghost small act-edit">Edit</button>
      <button class="btn ghost small act-del" title="Remove">✕</button>
    </div>`).join("");

  list.querySelectorAll(".act-edit").forEach(b =>
    b.addEventListener("click", e => openEditor(e.target.closest(".site-row").dataset.id)));
  list.querySelectorAll(".act-del").forEach(b =>
    b.addEventListener("click", e => {
      const id = e.target.closest(".site-row").dataset.id;
      const site = S.sites.find(s => s.id === id);
      gate(`Removing ${site.pattern} from your blocklist makes it fully accessible again.`, async () => {
        S.sites = S.sites.filter(s => s.id !== id);
        await save();
        renderSites();
        toast(`${site.pattern} removed`);
      });
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
  if (!p) { toast("That doesn't look like a domain"); return; }
  if (S.sites.some(s => s.pattern === p)) { toast(`${p} is already on the list`); return; }
  S.sites.unshift({ id: "s_" + Date.now().toString(36), pattern: p, mode: "always", schedule: [], limitMins: 30 });
  await save();
  renderSites();

  // Blocking instagram.com takes the DMs down with it — people are often
  // surprised by that, so offer the messages-only mode right here.
  if (p === "instagram.com") {
    toast("Instagram is fully blocked — DMs included.", {
      label: "Keep my DMs, block the rest",
      fn: async () => {
        S.sites = S.sites.filter(s => s.pattern !== "instagram.com");
        S.instagramDmOnly = true;
        await save();
        render();
        document.querySelector('.nav-item[data-section="shorts"]').click();
        toast("Messages-only mode is on. DMs work, the feed doesn't.");
      }
    });
    return;
  }
  toast(`${p} blocked, always. Click Edit to set a schedule or limit.`);
}

$("btn-add-site").addEventListener("click", () => { addSite($("add-site-input").value); $("add-site-input").value = ""; });
$("add-site-input").addEventListener("keydown", e => {
  if (e.key === "Enter") { addSite(e.target.value); e.target.value = ""; }
});
document.querySelectorAll("#presets .chip, #presets-games .chip").forEach(c =>
  c.addEventListener("click", () => addSite(c.dataset.site)));

// ---------------------------------------------------------------------------
// Site editor modal
// ---------------------------------------------------------------------------

let editing = null; // working copy

function openEditor(id) {
  const site = S.sites.find(s => s.id === id);
  editing = structuredClone(site);
  $("edit-title").textContent = `Edit ${site.pattern}`;
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
    toast("Saved");
  };

  if (weakening) {
    $("edit-backdrop").classList.add("hidden");
    gate(`Loosening the rules for ${old.pattern} gives the old habit a way back in.`, commit);
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
    gate(`Removing the keyword "${kw}" lets that content through everywhere.`, async () => {
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
    box.innerHTML = `<span class="hint" style="margin:0">Nothing here yet.</span>`;
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
  if (v.length < 3) { toast("Keywords under 3 characters would block half the internet"); return; }
  if (arr.includes(v)) { toast("Already on the list"); return; }
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

function bindToggle(elId, get, set, weakenDesc) {
  $(elId).addEventListener("change", async e => {
    const turningOff = !e.target.checked && get();
    if (turningOff && weakenDesc) {
      e.target.checked = true; // revert until the gate passes
      gate(weakenDesc, async () => { set(false); await save(); render(); });
    } else {
      set(e.target.checked);
      await save();
      render();
    }
  });
}

bindToggle("master-enabled", () => S.enabled, v => { S.enabled = v; },
  "Turning North off removes every block, limit and schedule at once.");
bindToggle("opt-shorts", () => S.shorts.enabled, v => { S.shorts.enabled = v; },
  "Re-opening short videos invites the most addictive feeds back in.");
bindToggle("opt-tiktok", () => S.shorts.blockTikTokEntirely, v => { S.shorts.blockTikTokEntirely = v; },
  "Unblocking TikTok opens an infinite short-video feed.");
bindToggle("opt-ig-dm", () => S.instagramDmOnly, v => { S.instagramDmOnly = v; },
  "Turning this off opens the full Instagram feed, Reels and Explore.");
bindToggle("opt-strict", () => S.strict.enabled, v => { S.strict.enabled = v; },
  "Without strict mode, every protection can be switched off instantly.");

// Narrow allowance, no gate either way.
$("opt-shorts-shared").addEventListener("change", async e => {
  S.shorts.allowSharedLinks = e.target.checked;
  await save();
});

// YouTube focus tools are quality-of-life, no gate.
$("opt-yt-home").addEventListener("change", async e => { S.youtube.hideHomeFeed = e.target.checked; await save(); });
$("opt-yt-related").addEventListener("change", async e => { S.youtube.hideRelated = e.target.checked; await save(); });
$("opt-yt-comments").addEventListener("change", async e => { S.youtube.hideComments = e.target.checked; await save(); });
$("opt-yt-subs").addEventListener("change", async e => { S.youtube.hideSubscriptions = e.target.checked; await save(); });
$("opt-yt-topic").addEventListener("change", async e => {
  S.youtube.topicMode = e.target.checked;
  await save();
  if (e.target.checked && !(S.youtube.allowedKeywords || []).length) {
    toast("Add a few topics below or every video will be hidden");
  }
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
  '"Every blocked tab is a small vote for the person you\'re becoming."',
  '"The feed misses you. Don\'t text back."',
  '"I\'d wave, but I\'m a sphere."',
  '"You bring the goals. I\'ll bring the stubbornness."',
  '"North is up. I checked."'
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
    gate("A shorter wait makes impulsive unlocks easier.", async () => {
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
    gate("Longer unlocks mean longer detours.", async () => {
      S.strict.maxUnlockMinutes = v; await save(); render();
    });
  } else {
    S.strict.maxUnlockMinutes = v; await save();
  }
});

// ---------------------------------------------------------------------------
// "Take me somewhere better" destinations
// ---------------------------------------------------------------------------

function renderBetterPlaces() {
  const box = $("bp-list");
  const places = S.betterPlaces || [];
  box.innerHTML = "";
  if (!places.length) {
    box.innerHTML = `<p class="hint" style="margin:0">Nowhere better yet. The block page will just send you back.</p>`;
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
  if (!label || !url) { toast("Needs both a label and a URL"); return; }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); } catch { toast("That URL doesn't parse"); return; }
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
  if (s.instagramDmOnly) score += 2;
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
  toast("Settings exported");
});

$("btn-import").addEventListener("click", () => $("import-file").click());

$("import-file").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("That file isn't valid JSON"); return; }
  const incoming = data?.settings;
  if (data?.north !== 1 || !incoming || typeof incoming !== "object" || !Array.isArray(incoming.sites)) {
    toast("That doesn't look like a North settings file");
    return;
  }
  const applyImport = async () => {
    S = incoming;
    await save();
    render();
    toast("Settings imported");
  };
  if (protectionScore(incoming) < protectionScore(S)) {
    gate("The file you're importing is weaker than your current protection.", applyImport);
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
    : `<p class="hint">No blocks recorded yet. Either very good or very new.</p>`;
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
    gate("Turning North off removes every block, limit and schedule at once.", async () => {
      S.enabled = false;
      await save();
      render();
      toast("Protection disabled. Nori will be here when you're ready.");
    });
  }
  if (m[1] === "endFocus") {
    gate("Ending the focus session early breaks the commitment you just made.", async () => {
      await chrome.runtime.sendMessage({ type: "endFocus" });
      toast("Focus session ended.");
    });
  }
}

$("wel-apply").addEventListener("click", async () => {
  S.shorts.enabled = $("wel-shorts").checked;
  S.instagramDmOnly = $("wel-ig").checked;
  S.strict.enabled = $("wel-strict").checked;
  await save();
  render();
  $("welcome-backdrop").classList.add("hidden");
  toast("Good start. Now add the sites that pull you in.");
  $("add-site-input").focus();
});

load();
checkIncognito();
