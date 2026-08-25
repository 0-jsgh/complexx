/**
 * app-ayuda.js — Solo maneja el tema oscuro/claro en la página de ayuda
 * (misma clave de localStorage que index.html e integral.html, para que
 * el tema se comparta entre las tres páginas).
 */
(function () {
  "use strict";

  const THEME_KEY = "linsolve-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("theme-toggle").textContent = theme === "light" ? "🌙" : "☀️";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* almacenamiento no disponible: el tema sigue activo en la sesión */
    }
  }

  function initialTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch (e) {
      /* localStorage no disponible */
    }
    return "dark";
  }

  applyTheme(initialTheme());
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "light" ? "dark" : "light");
  });
})();
