// North — global content script
// 1. Reports the page <title> so keyword blocking covers page content names.
// 2. Renders buddy "nudge" toasts sent by the background worker.

(() => {
  // --- Title reporting -------------------------------------------------------

  let lastTitle = "";
  function reportTitle() {
    const t = document.title || "";
    if (t && t !== lastTitle) {
      lastTitle = t;
      chrome.runtime.sendMessage({ type: "checkTitle", title: t }).catch(() => {});
    }
  }
  reportTitle();
  const titleEl = document.querySelector("title");
  if (titleEl) {
    new MutationObserver(reportTitle).observe(titleEl, { childList: true });
  }

  // --- SPA / back-forward-cache guard ---------------------------------------
  // Going "back" can restore a blocked page from the bfcache without a real
  // navigation, and SPAs rewrite the URL without loading. Watch for both and
  // ask the background worker to re-check.

  let lastHref = location.href;
  function recheckUrl(force = false) {
    if (force || location.href !== lastHref) {
      lastHref = location.href;
      chrome.runtime.sendMessage({ type: "checkUrl", url: location.href }).catch(() => {});
    }
  }
  setInterval(recheckUrl, 1000);
  window.addEventListener("popstate", () => setTimeout(recheckUrl, 50));
  window.addEventListener("pageshow", e => { if (e.persisted) recheckUrl(true); });

  // --- Buddy nudges ----------------------------------------------------------

  function showNudge(text) {
    document.getElementById("north-nudge")?.remove();
    const host = document.createElement("div");
    host.id = "north-nudge";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .toast {
          position: fixed; bottom: 28px; right: 28px; z-index: 2147483647;
          display: flex; align-items: center; gap: 12px;
          max-width: 360px; padding: 14px 18px;
          background: rgba(13, 18, 32, .96); color: #e7ecf5;
          border: 1px solid rgba(91, 110, 245, .35);
          border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
          font: 13.5px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          animation: in .35s cubic-bezier(.2,.9,.3,1.2);
        }
        .orb { flex: 0 0 30px; width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg,#5b6ef5,#2dd4bf);
          animation: breathe 3s ease-in-out infinite; }
        .x { margin-left: 4px; cursor: pointer; opacity: .5; font-size: 16px;
          background: none; border: none; color: inherit; }
        .x:hover { opacity: 1; }
        @keyframes in { from { transform: translateY(16px); opacity: 0; } }
        @keyframes breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.1) } }
      </style>
      <div class="toast">
        <div class="orb"></div>
        <div class="msg"></div>
        <button class="x" aria-label="Dismiss">×</button>
      </div>`;
    root.querySelector(".msg").textContent = text;
    root.querySelector(".x").onclick = () => host.remove();
    document.documentElement.appendChild(host);
    setTimeout(() => host.remove(), 12000);
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type === "north-nudge" && msg.text) showNudge(msg.text);
  });
})();
