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
  // Persistencia (localStorage): los datos sobreviven al cambiar de
  // página o cerrar la pestaña, hasta que el usuario los borre.
  // ------------------------------------------------------------------
  const STORAGE_KEY = "linsolve-system-state-v1";

  function saveState() {
    const state = {
      unknowns: getRowValues(unknownsList),
      knowns: getRowValues(knownsList),
      equations: getRowValues(equationsList),
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
  // Filas dinámicas
  // ------------------------------------------------------------------
  const unknownsList = document.getElementById("unknowns-list");
  const knownsList = document.getElementById("knowns-list");
  const equationsList = document.getElementById("equations-list");

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

    return { row, input };
  }

  function addUnknownRow(value) {
    const { row } = makeRow({
      placeholder: "x1",
      value,
      onRemove: (r) => {
        r.remove();
        syncEquationRows();
        saveState();
      },
    });
    unknownsList.appendChild(row);
    syncEquationRows();
  }

  function addKnownRow(value) {
    const { row, input } = makeRow({
      placeholder: "a=12  ó  3*b=\\ln(3/2)",
      value,
      onRemove: (r) => {
        r.remove();
        saveState();
      },
    });
    knownsList.appendChild(row);
    if (window.attachHighlight) window.attachHighlight(input);
  }

  /** Ajusta el número de filas de ecuación al número de incógnitas actuales, conservando texto ya escrito por índice. */
  function syncEquationRows() {
    const unknownCount = unknownsList.querySelectorAll("input").length;
    const currentValues = [...equationsList.querySelectorAll("input")].map((i) => i.value);
    equationsList.innerHTML = "";
    for (let i = 0; i < unknownCount; i++) {
      const { row, input } = makeRow({
        placeholder: i === 0 ? "3*x1+a*x2=b" : `ecuación ${i + 1}`,
        value: currentValues[i] || "",
        monoLabel: `Ec.${i + 1}`,
      });
      equationsList.appendChild(row);
      if (window.attachHighlight) window.attachHighlight(input);
    }
  }

  document.getElementById("add-unknown").addEventListener("click", () => {
    addUnknownRow("");
    saveState();
  });
  document.getElementById("add-known").addEventListener("click", () => {
    addKnownRow("");
    saveState();
  });

  // Cualquier tecleo en las tres listas guarda el estado (delegación de eventos).
  [unknownsList, knownsList, equationsList].forEach((list) => {
    list.addEventListener("input", saveState);
  });
  document.getElementById("context-text").addEventListener("input", saveState);

  // Restaura el estado guardado si existe; si no, precarga el ejemplo.
  const saved = loadState();
  if (saved && (saved.unknowns.length || saved.knowns.length || saved.equations.some((e) => e))) {
    (saved.unknowns.length ? saved.unknowns : [""]).forEach((v) => addUnknownRow(v));
    saved.knowns.forEach((v) => addKnownRow(v));
    const eqInputs = equationsList.querySelectorAll("input");
    saved.equations.forEach((v, i) => {
      setValue(eqInputs[i], v);
    });
    document.getElementById("context-text").value = saved.context || "";
  } else {
    addUnknownRow("x1");
    addUnknownRow("x2");
    addKnownRow("a=12");
    addKnownRow("3*b=\\ln(3/2)");
    const eqInputs = equationsList.querySelectorAll("input");
    setValue(eqInputs[0], "3*x1+a*x2=b");
    setValue(eqInputs[1], "x1-x2=1");
  }
  saveState();

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
    const { unknownNames, resolvedKnowns, knownTexts, equationTexts, x } = lastSolution;
    const titleInput = document.getElementById("pdf-title").value.trim();
    const title = titleInput || "Sistema de ecuaciones";
    const highlight = window.highlightToHtml || escapeHtml;

    let html = `<h1>${escapeHtml(title)}</h1>`;

    const contextText = document.getElementById("context-text").value.trim();
    if (contextText) {
      html += `<h2>Contexto</h2><p class="print-context">${escapeHtml(contextText).replace(/\n/g, "<br>")}</p>`;
    }

    html += `<h2>1 · Variables desconocidas</h2><p class="print-eq">${unknownNames.map((n) => highlight(n)).join(", ")}</p>`;

    html += `<h2>2 · Variables conocidas</h2>`;
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

    html += `<h2>3 · Sistema de ecuaciones (tal como se ingresó)</h2>`;
    equationTexts.forEach((text, i) => {
      html += `<p class="print-eq">Ec.${i + 1}: ${highlight(text)}</p>`;
    });

    html += `<h2>4 · Solución (eliminación gaussiana compleja)</h2>`;
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

  document.getElementById("clear-btn").addEventListener("click", () => {
    if (!confirm("¿Borrar todas las incógnitas, variables conocidas y ecuaciones?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* almacenamiento no disponible */
    }
    unknownsList.innerHTML = "";
    knownsList.innerHTML = "";
    equationsList.innerHTML = "";
    document.getElementById("context-text").value = "";
    addUnknownRow("");
    clearError();
    resultsSection.style.display = "none";
    lastSolution = null;
  });
})();
