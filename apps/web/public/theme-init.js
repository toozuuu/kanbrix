// Apply the saved appearance before the first paint, including the prerendered home page.
(() => {
  let preference;
  try {
    preference = localStorage.getItem("rusttrack-theme");
  } catch {
    // Storage can be unavailable in restricted browsing sessions.
  }
  const dark = preference === "dark" ||
    (preference !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.add(dark ? "dark" : "light");
  try {
    const scale = localStorage.getItem("kanbrix-font-scale");
    if (scale === "compact" || scale === "default" || scale === "comfortable" || scale === "large") {
      document.documentElement.dataset.fontScale = scale;
    }
  } catch {
    // Storage can be unavailable in restricted browsing sessions.
  }
})();
