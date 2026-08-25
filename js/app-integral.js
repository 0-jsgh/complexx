/**
 * app-integral.js — Conecta el DOM de integral.html con integral.js y
 * linsolve.js (variables conocidas, parser compartido).
 */
(function () {
  "use strict";

  const THEME_KEY = "linsolve-theme"; // misma clave que index.html: el tema se comparte entre páginas

  // ------------------------------------------------------------------
  // Tema
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Persistencia (localStorage): los datos sobreviven al cambiar de
  // página o cerrar la pestaña, hasta que el usuario los borre.
  // ------------------------------------------------------------------
  const STORAGE_KEY = "linsolve-integral-state-v1";

  function getRowValues(container) {
    return [...container.querySelectorAll("input")].map((i) => i.value.trim());
  }

  /** Asigna .value y dispara "input" para que la capa de resaltado (hl-backdrop)
   *  se sincronice; asignar .value directamente no dispara ese evento por sí solo,
   *  y el input real queda con texto transparente (invisible hasta seleccionarlo). */
  function setValue(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function saveState() {
    const state = {
      knowns: getRowValues(knownsList),
      varName: document.getElementById("var-name").value,
      lowerBound: document.getElementById("lower-bound").value,
      upperBound: document.getElementById("upper-bound").value,
      expression: document.getElementById("expression").value,
      context: document.getElementById("context-text").value,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* almacenamiento no disponible: los datos solo viven en esta sesión */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Filas dinámicas de variables conocidas
  // ------------------------------------------------------------------
  const knownsList = document.getElementById("knowns-list");

  function addKnownRow(value) {
    const row = document.createElement("div");
    row.className = "dyn-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "a=12  ó  3*b=\\ln(3/2)";
    input.value = value || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    row.appendChild(input);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "row-remove";
    removeBtn.setAttribute("aria-label", "Eliminar fila");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      row.remove();
      saveState();
    });
    row.appendChild(removeBtn);

    knownsList.appendChild(row);
    if (window.attachHighlight) window.attachHighlight(input);
  }

  document.getElementById("add-known").addEventListener("click", () => {
    addKnownRow("");
    saveState();
  });

  // Cualquier tecleo guarda el estado (delegación de eventos + campos sueltos).
  knownsList.addEventListener("input", saveState);
  ["lower-bound", "upper-bound", "expression"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", saveState);
    if (window.attachHighlight) window.attachHighlight(el);
  });
  document.getElementById("var-name").addEventListener("input", saveState);
  document.getElementById("context-text").addEventListener("input", saveState);

  // Restaura el estado guardado si existe; si no, precarga el ejemplo.
  const saved = loadState();
  if (saved && (saved.knowns.length || saved.varName || saved.lowerBound || saved.upperBound || saved.expression)) {
    saved.knowns.forEach((v) => addKnownRow(v));
    setValue(document.getElementById("var-name"), saved.varName || "");
    setValue(document.getElementById("lower-bound"), saved.lowerBound || "");
    setValue(document.getElementById("upper-bound"), saved.upperBound || "");
    setValue(document.getElementById("expression"), saved.expression || "");
    document.getElementById("context-text").value = saved.context || "";
  } else {
    addKnownRow("a=1");
    setValue(document.getElementById("lower-bound"), "0");
    setValue(document.getElementById("upper-bound"), "\\pi");
    setValue(document.getElementById("var-name"), "x");
    setValue(document.getElementById("expression"), "\\sin(x)");
  }
  saveState();

  // ------------------------------------------------------------------
  // Cálculo
  // ------------------------------------------------------------------
  const errorBox = document.getElementById("error-box");
  const resultsSection = document.getElementById("results");
  const resultsList = document.getElementById("results-list");
  const resultDetail = document.getElementById("result-detail");
  let lastResult = null;

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ------------------------------------------------------------------
  // Historial de resultados (solo integral: variable, límites, expresión
  // y resultado — las variables conocidas quedan fuera a propósito).
  // ------------------------------------------------------------------
  const HISTORY_KEY = "linsolve-integral-history-v1";
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(entries) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch (e) {
      /* almacenamiento no disponible */
    }
  }

  /** Divide una entrada del historial en sus líneas de presentación:
   *  "∫ desde {lower} hasta {upper}" y "{expresión} d{variable}", cada una
   *  en su propia línea (con espacio de por medio) tanto en pantalla como
   *  en el PDF. */
  function historyLines(entry) {
    return {
      bounds: `∫ desde ${entry.lower} hasta ${entry.upper}`,
      expr: `${entry.exprText} d${entry.varName}`,
    };
  }

  function makeHistoryId() {
    return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Actualiza el título de una entrada por id, sin volver a dibujar la
   *  lista completa (para no perder el foco mientras el usuario escribe). */
  function updateHistoryTitle(id, title) {
    const entries = loadHistory();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entry.title = title;
    saveHistory(entries);
  }

  function deleteHistoryEntry(id) {
    const entries = loadHistory().filter((e) => e.id !== id);
    saveHistory(entries);
    renderHistory(entries);
  }

  function renderHistory(entries) {
    historyList.innerHTML = "";
    historyEmpty.style.display = entries.length ? "none" : "block";
    const highlight = window.highlightToHtml || escapeHtml;
    // Más reciente primero.
    entries.slice().reverse().forEach((entry) => {
      const item = document.createElement("div");
      item.className = "history-entry";
      const time = entry.time ? new Date(entry.time).toLocaleString() : "";
      const { bounds, expr } = historyLines(entry);
      item.innerHTML = `
        <div class="history-header">
          <input type="text" class="history-title-input" placeholder="Título (opcional)" value="${escapeHtml(entry.title || "")}" />
          <button type="button" class="history-delete" aria-label="Eliminar este resultado" title="Eliminar este resultado">✕</button>
        </div>
        <div class="history-time">${escapeHtml(time)}</div>
        <div class="history-bounds">${highlight(bounds)}</div>
        <div class="history-expr">${highlight(expr)}</div>
        <div class="history-result">= ${escapeHtml(entry.result)}</div>
      `;
      item.querySelector(".history-title-input").addEventListener("input", (e) => {
        updateHistoryTitle(entry.id, e.target.value);
      });
      item.querySelector(".history-delete").addEventListener("click", () => {
        deleteHistoryEntry(entry.id);
      });
      historyList.appendChild(item);
    });
  }

  function addHistoryEntry(entry) {
    const entries = loadHistory();
    entries.push({ id: makeHistoryId(), title: "", ...entry });
    saveHistory(entries);
    renderHistory(entries);
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory([]);
  }

  renderHistory(loadHistory());

  document.getElementById("clear-history-btn").addEventListener("click", () => {
    if (!confirm("¿Borrar el historial de resultados de la integral?")) return;
    clearHistory();
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
    resultsSection.style.display = "none";
  }

  function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  /** Evalúa un texto de límite (real) usando solo variables conocidas + reservadas. */
  function evalRealBound(text, label, ctx) {
    if (!text) throw new Error(`Falta el límite ${label} de la integral.`);
    let node;
    try {
      node = parseEquation(text);
    } catch (e) {
      throw new Error(`Límite ${label}: ${e.message}`);
    }
    if (node.type === "eq") throw new Error(`El límite ${label} no debe contener '='.`);
    let value;
    try {
      value = evaluate(node, ctx);
    } catch (e) {
      throw new Error(`Límite ${label}: ${e.message}`);
    }
    if (Math.abs(value.im) > 1e-9) {
      throw new Error(`El límite ${label} debe ser un número real (se obtuvo ${value.toDisplayString()}).`);
    }
    return value.re;
  }

  function solve() {
    clearError();
    lastResult = null;
    try {
      // 1) Variables conocidas, en orden
      const knownTexts = getRowValues(knownsList).filter((v) => v.length > 0);
      const knownValues = {};
      const resolvedKnowns = [];
      for (const text of knownTexts) {
        const { name, value } = resolveKnownVariable(text, knownValues);
        if (name in knownValues) {
          throw new Error(`"${name}" ya fue definida antes; solo se permite una definición por variable.`);
        }
        knownValues[name] = value;
        resolvedKnowns.push({ name, value });
      }

      const ctx = { ...reservedContext(), ...knownValues };

      // 2) Variable de integración
      const varName = document.getElementById("var-name").value.trim();
      if (!varName) throw new Error("Indica el nombre de la variable de integración (por ejemplo, x).");
      assertValidName(varName, "variable de integración");
      if (varName in knownValues) {
        throw new Error(`"${varName}" ya está definida como variable conocida; usa otro nombre para integrar.`);
      }

      // 3) Límites (reales, evaluados sin la variable de integración en contexto)
      const lower = evalRealBound(document.getElementById("lower-bound").value.trim(), "inferior", ctx);
      const upper = evalRealBound(document.getElementById("upper-bound").value.trim(), "superior", ctx);

      // 4) Expresión a integrar
      const exprText = document.getElementById("expression").value.trim();
      if (!exprText) throw new Error("Escribe la expresión a integrar.");
      let exprNode;
      try {
        exprNode = parseEquation(exprText);
      } catch (e) {
        throw new Error(`Expresión: ${e.message}`);
      }

      const result = integrateExpression(exprNode, varName, lower, upper, ctx);

      resultsList.innerHTML = "";
      const item = document.createElement("div");
      item.className = "result-item";
      item.innerHTML = `<span class="result-name">∫ f(${varName}) d${varName}</span><span>${result.toDisplayString()}</span>`;
      resultsList.appendChild(item);

      if (resolvedKnowns.length) {
        const divider = document.createElement("div");
        divider.className = "result-item";
        divider.innerHTML = `<span class="result-name" style="opacity:.6">— variables usadas —</span><span></span>`;
        resultsList.appendChild(divider);
        resolvedKnowns.forEach(({ name, value }) => {
          const row = document.createElement("div");
          row.className = "result-item";
          row.innerHTML = `<span class="result-name">${name}</span><span>${value.toDisplayString()}</span>`;
          resultsList.appendChild(row);
        });
      }

      resultDetail.textContent = `Límites evaluados: ${lower} → ${upper}. Cuadratura de Simpson adaptativa sobre parte real e imaginaria por separado.`;
      resultsSection.style.display = "block";

      addHistoryEntry({
        varName,
        lower: String(lower),
        upper: String(upper),
        exprText,
        result: result.toDisplayString(),
        time: new Date().toISOString(),
      });

      lastResult = { knownTexts, resolvedKnowns, varName, lower, upper, exprText, result };
      return true;
    } catch (e) {
      showError(e.message || String(e));
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Reporte PDF (vía impresión del navegador, sin librerías externas)
  // ------------------------------------------------------------------
  function buildPrintReport() {
    const { knownTexts, resolvedKnowns } = lastResult;
    const titleInput = document.getElementById("pdf-title").value.trim();
    const title = titleInput || "Integral definida";
    const highlight = window.highlightToHtml || escapeHtml;

    let html = `<h1>${escapeHtml(title)}</h1>`;

    const contextText = document.getElementById("context-text").value.trim();
    if (contextText) {
      html += `<h2>Contexto</h2><p class="print-context">${escapeHtml(contextText).replace(/\n/g, "<br>")}</p>`;
    }

    html += `<h2>1 · Variables definidas</h2>`;
    if (knownTexts.length === 0) {
      html += `<p class="print-eq">(ninguna)</p>`;
    } else {
      html += `<table><tr><th>Definición</th><th>Valor resuelto</th></tr>`;
      knownTexts.forEach((text, i) => {
        const rk = resolvedKnowns[i];
        html += `<tr><td>${highlight(text)}</td><td>${rk.name} = ${rk.value.toDisplayString()}</td></tr>`;
      });
      html += `</table>`;
    }

    const history = loadHistory();
    if (history.length) {
      html += `<h2>2 · Historial de resultados</h2>`;
      html += `<table><tr><th>Título</th><th>Fecha y hora</th><th>Integral</th><th>Resultado</th></tr>`;
      history.slice().reverse().forEach((entry) => {
        const time = entry.time ? new Date(entry.time).toLocaleString() : "";
        const { bounds, expr } = historyLines(entry);
        const titleCell = entry.title ? escapeHtml(entry.title) : "—";
        html += `<tr><td>${titleCell}</td><td>${escapeHtml(time)}</td><td>${highlight(bounds)}<br>${highlight(expr)}</td><td>${escapeHtml(entry.result)}</td></tr>`;
      });
      html += `</table>`;
    }

    document.getElementById("print-report").innerHTML = html;
  }

  document.getElementById("pdf-btn").addEventListener("click", () => {
    const ok = solve(); // siempre recalcula, para que el PDF refleje los datos actuales
    if (!ok) return; // hay un error visible; no se genera el PDF
    buildPrintReport();
    window.print();
  });

  document.getElementById("solve-btn").addEventListener("click", solve);

  document.getElementById("clear-btn").addEventListener("click", () => {
    if (!confirm("¿Borrar las variables definidas, los datos de la integral y el historial de resultados?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* almacenamiento no disponible */
    }
    knownsList.innerHTML = "";
    setValue(document.getElementById("var-name"), "");
    setValue(document.getElementById("lower-bound"), "");
    setValue(document.getElementById("upper-bound"), "");
    setValue(document.getElementById("expression"), "");
    document.getElementById("context-text").value = "";
    clearError();
    resultsSection.style.display = "none";
    lastResult = null;
    clearHistory();
  });
})();
