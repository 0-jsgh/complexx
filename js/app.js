/**
 * app.js — Conecta el DOM con linsolve.js: filas dinámicas de incógnitas,
 * variables conocidas y ecuaciones; tema oscuro/claro; y el flujo de
 * resolución con manejo de errores.
 */
(function () {
  "use strict";

  const THEME_KEY = "linsolve-theme";

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
  // Filas dinámicas
  // ------------------------------------------------------------------
  const unknownsList = document.getElementById("unknowns-list");
  const knownsList = document.getElementById("knowns-list");
  const equationsList = document.getElementById("equations-list");

  function makeRow({ placeholder, value, onRemove, monoLabel }) {
    const row = document.createElement("div");
    row.className = "dyn-row";

    if (monoLabel !== undefined) {
      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = monoLabel;
      row.appendChild(label);
    }

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder || "";
    input.value = value || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    row.appendChild(input);

    if (onRemove) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "row-remove";
      removeBtn.setAttribute("aria-label", "Eliminar fila");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => onRemove(row));
      row.appendChild(removeBtn);
    }

    row.querySelector("input").addEventListener("input", () => {}); // hook reservado

    return { row, input };
  }

  function addUnknownRow(value) {
    const { row } = makeRow({
      placeholder: "x1",
      value,
      onRemove: (r) => {
        r.remove();
        syncEquationRows();
      },
    });
    unknownsList.appendChild(row);
    syncEquationRows();
  }

  function addKnownRow(value) {
    const { row } = makeRow({
      placeholder: "a=12  ó  3*b=\\ln(3/2)",
      value,
      onRemove: (r) => r.remove(),
    });
    knownsList.appendChild(row);
  }

  /** Ajusta el número de filas de ecuación al número de incógnitas actuales, conservando texto ya escrito por índice. */
  function syncEquationRows() {
    const unknownCount = unknownsList.querySelectorAll("input").length;
    const currentValues = [...equationsList.querySelectorAll("input")].map((i) => i.value);
    equationsList.innerHTML = "";
    for (let i = 0; i < unknownCount; i++) {
      const { row } = makeRow({
        placeholder: i === 0 ? "3*x1+a*x2=b" : `ecuación ${i + 1}`,
        value: currentValues[i] || "",
        monoLabel: `Ec.${i + 1}`,
      });
      equationsList.appendChild(row);
    }
  }

  document.getElementById("add-unknown").addEventListener("click", () => addUnknownRow(""));
  document.getElementById("add-known").addEventListener("click", () => addKnownRow(""));

  // Filas iniciales de ejemplo.
  addUnknownRow("x1");
  addUnknownRow("x2");
  addKnownRow("a=12");
  addKnownRow("3*b=\\ln(3/2)");
  const eqInputs = equationsList.querySelectorAll("input");
  if (eqInputs[0]) eqInputs[0].value = "3*x1+a*x2=b";
  if (eqInputs[1]) eqInputs[1].value = "x1-x2=1";

  // ------------------------------------------------------------------
  // Resolución
  // ------------------------------------------------------------------
  const errorBox = document.getElementById("error-box");
  const resultsSection = document.getElementById("results");
  const resultsList = document.getElementById("results-list");
  let lastSolution = null;

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

  function showResults(unknownNames, values, resolvedKnowns) {
    resultsList.innerHTML = "";

    unknownNames.forEach((name, i) => {
      const item = document.createElement("div");
      item.className = "result-item";
      item.innerHTML = `<span class="result-name">${name}</span><span>${values[i].toDisplayString()}</span>`;
      resultsList.appendChild(item);
    });

    if (resolvedKnowns.length) {
      const divider = document.createElement("div");
      divider.className = "result-item";
      divider.innerHTML = `<span class="result-name" style="opacity:.6">— variables conocidas —</span><span></span>`;
      resultsList.appendChild(divider);
      resolvedKnowns.forEach(({ name, value }) => {
        const item = document.createElement("div");
        item.className = "result-item";
        item.innerHTML = `<span class="result-name">${name}</span><span>${value.toDisplayString()}</span>`;
        resultsList.appendChild(item);
      });
    }

    resultsSection.style.display = "block";
  }

  function getRowValues(container) {
    return [...container.querySelectorAll("input")].map((i) => i.value.trim());
  }

  function solve() {
    clearError();
    lastSolution = null;
    try {
      // 1) Incógnitas
      const unknownNames = getRowValues(unknownsList).filter((v) => v.length > 0);
      if (unknownNames.length === 0) {
        throw new Error("Define al menos una variable desconocida.");
      }
      unknownNames.forEach((n) => assertValidName(n, "incógnita"));
      const dupUnknown = unknownNames.find((n, i) => unknownNames.indexOf(n) !== i);
      if (dupUnknown) throw new Error(`La incógnita "${dupUnknown}" está repetida.`);

      // 2) Variables conocidas (en orden, cada una puede usar las anteriores)
      const knownTexts = getRowValues(knownsList).filter((v) => v.length > 0);
      const knownValues = {};
      const resolvedKnowns = [];
      for (const text of knownTexts) {
        const { name, value } = resolveKnownVariable(text, knownValues);
        if (unknownNames.includes(name)) {
          throw new Error(`"${name}" ya está declarada como incógnita; no puede ser también una variable conocida.`);
        }
        if (name in knownValues) {
          throw new Error(`"${name}" ya fue definida antes; solo se permite una definición por variable.`);
        }
        knownValues[name] = value;
        resolvedKnowns.push({ name, value });
      }

      // 3) Ecuaciones
      const equationTexts = getRowValues(equationsList);
      if (equationTexts.length !== unknownNames.length) {
        throw new Error(
          `Se requieren ${unknownNames.length} ecuaciones para ${unknownNames.length} incógnitas (hay ${equationTexts.length}).`
        );
      }
      if (equationTexts.some((t) => t.length === 0)) {
        throw new Error("Todas las ecuaciones deben estar completas.");
      }

      const { A, b } = buildLinearSystem(equationTexts, unknownNames, knownValues);
      const x = solveComplexLinearSystem(A, b);

      lastSolution = { unknownNames, resolvedKnowns, knownTexts, equationTexts, A, b, x };
      showResults(unknownNames, x, resolvedKnowns);
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
    const { unknownNames, resolvedKnowns, knownTexts, equationTexts, A, b, x } = lastSolution;
    const now = new Date().toLocaleString();

    let html = `<h1>Resolvedor de Sistemas de Ecuaciones — Informe</h1>`;
    html += `<p class="print-meta">Generado el ${now}</p>`;

    html += `<h2>1 · Variables desconocidas</h2><p class="print-eq">${unknownNames.map(escapeHtml).join(", ")}</p>`;

    html += `<h2>2 · Variables conocidas</h2>`;
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

    html += `<h2>3 · Sistema de ecuaciones (tal como se ingresó)</h2>`;
    equationTexts.forEach((text, i) => {
      html += `<p class="print-eq">Ec.${i + 1}: ${escapeHtml(text)}</p>`;
    });

    html += `<h2>4 · Procedimiento — extracción de coeficientes por sondeo</h2>`;
    html += `<p class="print-eq">Cada ecuación se evalúa con las incógnitas en 0 (constante) y en 1 una por una (coeficiente), asumiendo que la ecuación es afín en las incógnitas.</p>`;
    html += `<table><tr><th>Ecuación</th>${unknownNames.map((u) => `<th>coef. de ${u}</th>`).join("")}<th>término independiente</th></tr>`;
    A.forEach((row, i) => {
      html += `<tr><td>Ec.${i + 1}</td>${row.map((c) => `<td>${c.toDisplayString()}</td>`).join("")}<td>${b[i].toDisplayString()}</td></tr>`;
    });
    html += `</table>`;

    html += `<h2>5 · Solución (eliminación gaussiana compleja)</h2>`;
    html += `<table><tr><th>Variable</th><th>Valor</th></tr>`;
    unknownNames.forEach((name, i) => {
      html += `<tr><td>${name}</td><td class="print-final">${x[i].toDisplayString()}</td></tr>`;
    });
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
