/**
 * highlight.js — Colorea sintaxis dentro de <input type="text">.
 *
 * Un <input> nativo no permite colorear caracteres individuales solo con
 * CSS (su contenido no es un árbol de nodos). La técnica: una capa
 * "backdrop" detrás del input, con el mismo texto envuelto en <span>
 * coloreados; el input real queda con texto transparente pero visible
 * (cursor, selección, foco) encima. Ambas capas se mantienen sincronizadas
 * en tamaño, tipografía y scroll.
 *
 * Colorea:
 *  - '(' '{' y ')' '}' por nivel de anidación (ciclo de 6 colores)
 *  - comandos \algo (\ln, \pi, \sin, ...)
 *  - '=' con su propio color
 *  - operadores + - * / ^
 */
(function () {
  "use strict";

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const BRACKET_LEVELS = 6;

  function highlightToHtml(text) {
    let html = "";
    let depth = 0;
    let i = 0;
    const n = text.length;

    while (i < n) {
      const c = text[i];

      if (c === "(" || c === "{") {
        const lvl = depth % BRACKET_LEVELS;
        html += `<span class="tok-bracket tok-lvl${lvl}">${escapeHtml(c)}</span>`;
        depth++;
        i++;
        continue;
      }
      if (c === ")" || c === "}") {
        depth = Math.max(0, depth - 1);
        const lvl = depth % BRACKET_LEVELS;
        html += `<span class="tok-bracket tok-lvl${lvl}">${escapeHtml(c)}</span>`;
        i++;
        continue;
      }
      if (c === "\\") {
        let j = i + 1;
        while (j < n && /[A-Za-z]/.test(text[j])) j++;
        html += `<span class="tok-command">${escapeHtml(text.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (c === "=") {
        html += `<span class="tok-equals">=</span>`;
        i++;
        continue;
      }
      if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
        html += `<span class="tok-op">${escapeHtml(c)}</span>`;
        i++;
        continue;
      }
      html += escapeHtml(c);
      i++;
    }
    return html.length ? html : "&nbsp;";
  }

  const SYNCED_STYLE_PROPS = [
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius",
    "fontFamily", "fontSize", "fontWeight", "letterSpacing", "textAlign", "lineHeight",
  ];

  /** Convierte un <input type="text"> existente en un campo con resaltado de sintaxis. */
  function attachHighlight(input) {
    if (!input || input.dataset.hlAttached) return;
    input.dataset.hlAttached = "1";

    // Captura solo geometría/tipografía (padding, radios, fuente) — nunca
    // color, fondo o borde: esos deben quedar en manos de las variables CSS
    // para reaccionar en vivo al cambiar de tema (ver .hl-backdrop).
    const cs = getComputedStyle(input);
    const captured = {};
    SYNCED_STYLE_PROPS.forEach((p) => (captured[p] = cs[p]));

    const backdrop = document.createElement("div");
    backdrop.className = "hl-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    Object.keys(captured).forEach((p) => (backdrop.style[p] = captured[p]));

    input.insertAdjacentElement("afterend", backdrop);
    input.classList.add("hl-input");

    function syncSize() {
      backdrop.style.left = input.offsetLeft + "px";
      backdrop.style.top = input.offsetTop + "px";
      backdrop.style.width = input.offsetWidth + "px";
      backdrop.style.height = input.offsetHeight + "px";
    }

    function render() {
      backdrop.innerHTML = highlightToHtml(input.value);
      backdrop.scrollLeft = input.scrollLeft;
    }

    syncSize();
    render();

    input.addEventListener("input", render);
    input.addEventListener("scroll", () => (backdrop.scrollLeft = input.scrollLeft));
    window.addEventListener("resize", syncSize);

    // Reintento diferido: si attachHighlight se llamó con el input todavía
    // desconectado del documento (offsetWidth/offsetLeft en 0), este ajuste
    // corrige la geometría en cuanto el navegador ya lo haya insertado y
    // calculado su layout real.
    requestAnimationFrame(syncSize);

    // Mantiene la capa sincronizada ante cualquier cambio de tamaño del
    // input (responsive, fuente cargando tarde, etc.), sin depender de que
    // el código que lo creó recuerde llamar a syncSize manualmente.
    if (window.ResizeObserver) {
      new ResizeObserver(syncSize).observe(input);
    }
  }

  window.attachHighlight = attachHighlight;
  // Se expone también la función de coloreado sola (sin backdrop/input), para
  // reutilizar la misma paleta de sintaxis en texto de solo lectura (p. ej.
  // las entradas del historial de resultados).
  window.highlightToHtml = highlightToHtml;
})();
