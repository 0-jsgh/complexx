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
    removeBtn.addEventListener("click", () => row.remove());
    row.appendChild(removeBtn);

    knownsList.appendChild(row);
  }

  document.getElementById("add-known").addEventListener("click", () => addKnownRow(""));

  // Fila inicial y ejemplo funcional precargado.
  addKnownRow("a=1");
  document.getElementById("lower-bound").value = "0";
  document.getElementById("upper-bound").value = "\\pi";
  document.getElementById("var-name").value = "x";
  document.getElementById("expression").value = "\\sin(x)";

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

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
    resultsSection.style.display = "none";
  }

  function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  function getRowValues(container) {
    return [...container.querySelectorAll("input")].map((i) => i.value.trim());
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
    const { knownTexts, resolvedKnowns, varName, lower, upper, exprText, result } = lastResult;
    const now = new Date().toLocaleString();

    let html = `<h1>Integral Definida — Informe</h1>`;
    html += `<p class="print-meta">Generado el ${now}</p>`;

    html += `<h2>1 · Variables definidas</h2>`;
    if (knownTexts.length === 0) {
      html += `<p class="print-eq">(ninguna)</p>`;
    } else {
      html += `<table><tr><th>Definición</th><th>Valor resuelto</th></tr>`;
      knownTexts.forEach((text, i) => {
        const rk = resolvedKnowns[i];
        html += `<tr><td>${escapeHtml(text)}</td><td>${rk.name} = ${rk.value.toDisplayString()}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<h2>2 · Integral planteada</h2>`;
    html += `<p class="print-eq">∫ desde ${varName} = ${lower} hasta ${varName} = ${upper} de f(${varName}) = ${escapeHtml(exprText)} d${varName}</p>`;

    html += `<h2>3 · Procedimiento</h2>`;
    html += `<p class="print-eq">Integración numérica por cuadratura de Simpson adaptativa (sin integración simbólica). La parte real e imaginaria de f(${varName}) se integran por separado sobre el intervalo real [${lower}, ${upper}] y se recomponen en un resultado complejo.</p>`;

    html += `<h2>4 · Resultado</h2>`;
    html += `<table><tr><th>Expresión</th><th>Valor</th></tr>`;
    html += `<tr><td>∫ f(${varName}) d${varName}</td><td class="print-final">${result.toDisplayString()}</td></tr>`;
    html += `</table>`;

    document.getElementById("print-report").innerHTML = html;
  }

  document.getElementById("pdf-btn").addEventListener("click", () => {
    const ok = solve(); // siempre recalcula, para que el PDF refleje los datos actuales
    if (!ok) return; // hay un error visible; no se genera el PDF
    buildPrintReport();
    window.print();
  });

  document.getElementById("solve-btn").addEventListener("click", solve);
})();
