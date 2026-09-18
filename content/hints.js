// North — discovery hints, shared by the site content scripts.
//
// Most people never open a settings page, so the switches that would help them
// most stay switched off. A hint is a small card, shown on the site it is
// about, at the moment the page is doing the thing it describes: the YouTube
// homepage laying out forty thumbnails, the comments loading under a video.
//
// The site scripts own the moment; the background worker owns the policy (what
// the card says, whether it may be shown at all, and applying the switch). A
// hint is offered at most twice for an idea, and the card never talks anyone
// into a protection that costs a wait and a challenge to reverse — an
// introduction that sets a trap isn't an introduction.
//
// Exposes window.northHint = { show, afterDwell, whenSeen, reset }.

(() => {
  const HOST_ID = "north-hint";
  const AUTO_CLOSE_MS = 30e3;   // an unanswered card lets itself out
  const UNDO_MS = 30e3;         // and the confirmation holds the undo this long

  const timers = new Set();
  let askedHere = new Set();    // ids already asked about on this page
  let cardOpen = false;

  const MARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 19 20.5 12 17 5 20.5Z"/></svg>`;

  function send(msg) {
    try { return chrome.runtime.sendMessage(msg); }
    catch { return Promise.resolve(null); }  // extension reloaded mid-page
  }

  function close(host) {
    host.remove();
    cardOpen = false;
  }

  function render(offer) {
    document.getElementById(HOST_ID)?.remove();
    const host = document.createElement("div");
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .card {
          position: fixed; bottom: 26px; left: 26px; z-index: 2147483647;
          box-sizing: border-box; width: 336px; max-width: calc(100vw - 32px);
          padding: 18px 18px 14px;
          background: #1b1e19; color: #eeece2;
          border: 1px solid rgba(219, 224, 205, .14);
          border-radius: 16px; box-shadow: 0 24px 64px -18px rgba(0,0,0,.6);
          font: 13.5px/1.55 'DM Sans', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          animation: rise .4s cubic-bezier(.22,.61,.36,1);
        }
        @keyframes rise { from { transform: translateY(14px); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .card { animation: none } }
        .head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .mark { flex: 0 0 26px; width: 26px; height: 26px; border-radius: 8px;
          display: grid; place-items: center;
          background: linear-gradient(150deg,#4e8c6a,#315744 52%,#24503c); }
        .mark svg { width: 54%; height: 54%; fill: #fff; }
        .from { font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
          color: rgba(238,236,226,.5); }
        .x { margin-left: auto; width: 24px; height: 24px; padding: 0; cursor: pointer;
          background: none; border: none; border-radius: 6px; color: inherit;
          opacity: .45; font-size: 17px; line-height: 1; font-family: inherit; }
        .x:hover { opacity: 1; background: rgba(219,224,205,.08); }
        h2 { margin: 0 0 6px; font: 400 21px/1.25 'Instrument Serif', Georgia, serif; }
        p { margin: 0; color: rgba(238,236,226,.72); }
        .row { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
        button.act { font: 500 13px/1 inherit; font-family: inherit; cursor: pointer;
          padding: 9px 14px; border-radius: 9px; border: 1px solid transparent; }
        .primary { background: #4e8c6a; color: #0f1510; }
        .primary:hover { background: #5b9c78; }
        .ghost { background: none; color: rgba(238,236,226,.72);
          border-color: rgba(219,224,205,.18); }
        .ghost:hover { color: #eeece2; background: rgba(219,224,205,.07); }
        .off { margin: 12px 0 0; padding: 0; background: none; border: none;
          font: inherit; font-size: 11.5px; color: rgba(238,236,226,.4);
          text-decoration: underline; cursor: pointer; }
        .off:hover { color: rgba(238,236,226,.75); }
        .done h2 { font-size: 19px; }
      </style>
      <div class="card" role="region" aria-label="A tip from North">
        <div class="head">
          <div class="mark">${MARK}</div>
          <span class="from">North</span>
          <button class="x" aria-label="Dismiss">&times;</button>
        </div>
        <div class="body">
          <h2></h2>
          <p></p>
          <div class="row">
            <button class="act primary" id="cta"></button>
            <button class="act ghost" id="not-now">Not now</button>
          </div>
          <button class="off">Don't show me tips like this</button>
        </div>
      </div>`;

    root.querySelector("h2").textContent = offer.title;
    root.querySelector("p").textContent = offer.body;
    root.querySelector("#cta").textContent = offer.cta;

    cardOpen = true;
    document.documentElement.appendChild(host);

    const autoClose = setTimeout(() => close(host), AUTO_CLOSE_MS);
    const stop = () => { clearTimeout(autoClose); };

    const onKey = e => { if (e.key === "Escape" && document.getElementById(HOST_ID)) { stop(); close(host); } };
    document.addEventListener("keydown", onKey, true);
    const cleanup = new MutationObserver(() => {
      if (!host.isConnected) { document.removeEventListener("keydown", onKey, true); cleanup.disconnect(); }
    });
    cleanup.observe(document.documentElement, { childList: true });

    root.querySelector(".x").onclick = () => { stop(); close(host); };
    root.querySelector("#not-now").onclick = () => { stop(); close(host); };

    root.querySelector(".off").onclick = async () => {
      stop();
      await send({ type: "hintOff" });
      confirmation(root, host, "That's the last one.",
        "North won't suggest anything on a page again. Every switch is still in settings.", false);
    };

    root.querySelector("#cta").onclick = async () => {
      stop();
      const res = await send({ type: "hintAction", id: offer.id });
      if (!res?.ok) return close(host);
      if (res.opened) return close(host);
      confirmation(root, host, "Done.", res.done, res.undoable, offer.id);
    };
  }

  /** The card turns into its own receipt: what changed, and the way back. */
  function confirmation(root, host, title, body, undoable, id) {
    const b = root.querySelector(".body");
    b.classList.add("done");
    b.innerHTML = `<h2></h2><p></p><div class="row"></div>`;
    b.querySelector("h2").textContent = title;
    b.querySelector("p").textContent = body;
    if (undoable) {
      const undo = document.createElement("button");
      undo.className = "act ghost";
      undo.textContent = "Undo";
      undo.onclick = async () => {
        await send({ type: "hintUndo", id });
        close(host);
      };
      b.querySelector(".row").appendChild(undo);
    }
    setTimeout(() => close(host), undoable ? UNDO_MS : 6000);
  }

  // --- The three ways a site script asks for one ----------------------------

  /** Ask the worker whether this hint may be shown, and show it if so. */
  async function show(id) {
    if (cardOpen || askedHere.has(id)) return;
    askedHere.add(id);
    const offer = await send({ type: "hintCheck", id });
    // A second card would be a pop-up; the quota is spent either way.
    if (offer?.show && !cardOpen && !document.hidden) render(offer);
  }

  /**
   * Show it once the page has been sat with, not the moment it loads: only
   * time spent looking at the tab counts, and `stillRelevant` gets the last
   * word in case the page moved on underneath.
   */
  function afterDwell(id, seconds, stillRelevant = () => true) {
    let waited = 0;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++waited < seconds) return;
      clearInterval(t);
      timers.delete(t);
      if (stillRelevant()) show(id);
    }, 1000);
    timers.add(t);
  }

  /**
   * Show it when a part of the page scrolls into view and stays there —
   * the comments, a rail, whatever the hint is actually about.
   */
  function whenSeen(id, selector, seconds = 2) {
    let armed = null;
    let looked = 0;
    const look = setInterval(() => {
      // Some videos have comments turned off, and some outlets have no rail.
      // Give up after two minutes rather than polling for the tab's lifetime.
      if (++looked > 240) { clearInterval(look); timers.delete(look); return; }
      const target = document.querySelector(selector);
      if (!target) return;
      clearInterval(look);
      timers.delete(look);
      const io = new IntersectionObserver(entries => {
        const seen = entries.some(e => e.isIntersecting);
        if (seen && !armed) {
          armed = setTimeout(() => { io.disconnect(); show(id); }, seconds * 1000);
          timers.add(armed);
        } else if (!seen && armed) {
          clearTimeout(armed);
          timers.delete(armed);
          armed = null;
        }
      }, { threshold: 0.2 });
      io.observe(target);
    }, 500);
    timers.add(look);
  }

  /** A single-page navigation is a new page: drop the timers and start over. */
  function reset() {
    for (const t of timers) { clearInterval(t); clearTimeout(t); }
    timers.clear();
    askedHere = new Set();
  }

  window.northHint = { show, afterDwell, whenSeen, reset };
})();
