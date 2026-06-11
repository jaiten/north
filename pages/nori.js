// North — Nori the character, shared by every page.
// 1. Applies the saved theme before first paint (cached per-device so there's
//    no dark flash while settings load; the settings value wins once it arrives).
// 2. Makes every .eyes pair follow the cursor.

document.documentElement.dataset.theme = localStorage.getItem("north-theme") || "light";

/** Apply a theme and remember it for the next page load. */
function northApplyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("north-theme", t); } catch { /* storage full/blocked */ }
}

(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let raf = null;
  addEventListener("mousemove", e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      document.querySelectorAll(".eyes").forEach(eyes => {
        const r = eyes.getBoundingClientRect();
        if (!r.width) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(2.2, d / 50);
        eyes.style.setProperty("--px", (dx / d) * reach + "px");
        eyes.style.setProperty("--py", (dy / d) * reach + "px");
      });
    });
  }, { passive: true });
})();
