// North theme helper, shared by every page.
// Applies the saved theme before first paint (cached per-device so there's no
// dark flash while settings load; the settings value wins once it arrives).

document.documentElement.dataset.theme = localStorage.getItem("north-theme") || "light";

/** Apply a theme and remember it for the next page load. */
function northApplyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("north-theme", t); } catch { /* storage full/blocked */ }
}
