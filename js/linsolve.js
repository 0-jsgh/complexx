/**
 * linsolve.js — Orquesta la resolución:
 *  1) resolveKnownVariable: despeja una variable conocida, explícita
 *     ("a=12") o implícita ("3*b=\ln(3/2)"), por sondeo afín.
 *  2) buildLinearSystem: para cada ecuación con n incógnitas, sondea la
 *     ecuación para extraer sus coeficientes lineales (sin derivar
 *     símbolicamente) y valida que sea realmente afín en las incógnitas.
 *  3) solveComplexLinearSystem: eliminación gaussiana con pivoteo parcial
 *     sobre números complejos.
 *
 * Palabras reservadas: `e` (Euler), `j` (unidad imaginaria), `pi`, y los
 * nombres de función `ln`, `log`, `sqrt`, `exp`.
 */

const RESERVED_NAMES = new Set([
  "e", "j", "pi", "ln", "log", "sqrt", "exp",
  "sin", "cos", "tan", "cot", "sec", "csc",
  "asin", "acos", "atan", "acot", "asec", "acsc",
  "sinh", "cosh", "tanh", "coth", "sech", "csch",
  "asinh", "acosh", "atanh", "acoth", "asech", "acsch",
]);
const LINEARITY_TOLERANCE = 1e-6;

function reservedContext() {
  return { e: new Complex(Math.E, 0), j: new Complex(0, 1) };
}

/** Lanza un error si el nombre no es un identificador válido o está reservado. */
function assertValidName(name, kind) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
    throw new Error(`"${name}" no es un nombre de variable válido (usa letras y números, empezando por letra).`);
  }
  if (RESERVED_NAMES.has(name)) {
    throw new Error(`"${name}" es una palabra reservada y no puede usarse como nombre de ${kind}.`);
  }
}

/**
 * Despeja el valor de una variable conocida a partir de su definición de
 * texto ("a=12" o "3*b=\ln(3/2)"). La variable a despejar es el único
 * identificador de la ecuación que no aparece ya en `resolvedCtx` ni en
 * las palabras reservadas.
 * @param {string} text
 * @param {Record<string, Complex>} resolvedCtx variables conocidas ya resueltas
 * @returns {{ name: string, value: Complex }}
 */
function resolveKnownVariable(text, resolvedCtx) {
  const node = parseEquation(text);
  const names = collectVariableNames(node);
  const known = new Set([...Object.keys(resolvedCtx), ...RESERVED_NAMES]);
  const candidates = [...names].filter((n) => !known.has(n));

  if (candidates.length === 0) {
    throw new Error(`No se encontró ninguna variable nueva que definir en "${text}".`);
  }
  if (candidates.length > 1) {
    throw new Error(
      `"${text}" define más de una variable nueva a la vez (${candidates.join(", ")}); define una por fila.`
    );
  }

  const target = candidates[0];
  assertValidName(target, "variable conocida");

  const baseCtx = { ...reservedContext(), ...resolvedCtx };

  const ctx0 = { ...baseCtx, [target]: Complex.ZERO };
  const c = residual(node, ctx0);

  const ctx1 = { ...baseCtx, [target]: Complex.ONE };
  const v1 = residual(node, ctx1);
  const coef = v1.sub(c);

  if (coef.isZero()) {
    throw new Error(`No se pudo despejar "${target}" en "${text}" (coeficiente nulo).`);
  }

  const value = c.neg().div(coef);

  // Verificación de linealidad con un tercer punto de sondeo.
  const ctx2 = { ...baseCtx, [target]: new Complex(2, 0) };
  const actual2 = residual(node, ctx2);
  const predicted2 = coef.mul(new Complex(2, 0)).add(c);
  if (predicted2.sub(actual2).abs() > LINEARITY_TOLERANCE) {
    throw new Error(`"${text}" no es una ecuación lineal en "${target}" (revisa potencias o productos de "${target}" consigo misma).`);
  }

  return { name: target, value };
}

/**
 * Sondea una ecuación para extraer, sin derivar simbólicamente, sus
 * coeficientes respecto a `unknownNames` (asumiendo que la ecuación es
 * afín en esas incógnitas) y valida esa suposición.
 * @param {object} node AST de la ecuación (parseEquation)
 * @param {string[]} unknownNames
 * @param {Record<string, Complex>} knownCtx variables conocidas + reservadas
 * @param {number} eqIndex índice (1-based) para mensajes de error
 * @returns {{ coeffs: Complex[], rhs: Complex }}
 */
function probeEquation(node, unknownNames, knownCtx, eqIndex) {
  const zeroCtx = { ...knownCtx };
  unknownNames.forEach((u) => (zeroCtx[u] = Complex.ZERO));

  const c = residual(node, zeroCtx);

  const coeffs = unknownNames.map((u) => {
    const ctxUnit = { ...zeroCtx, [u]: Complex.ONE };
    const v = residual(node, ctxUnit);
    return v.sub(c);
  });

  // Chequeo 1: términos cruzados entre incógnitas (todas = 1 a la vez).
  const allOnesCtx = { ...knownCtx };
  unknownNames.forEach((u) => (allOnesCtx[u] = Complex.ONE));
  const predictedAllOnes = coeffs.reduce((acc, coef) => acc.add(coef), c);
  const actualAllOnes = residual(node, allOnesCtx);
  if (predictedAllOnes.sub(actualAllOnes).abs() > LINEARITY_TOLERANCE) {
    throw new Error(
      `La ecuación ${eqIndex} no parece lineal (se detectan términos que combinan varias incógnitas, como productos entre ellas).`
    );
  }

  // Chequeo 2: términos cuadráticos por incógnita (esa incógnita = 2, resto = 0).
  for (let i = 0; i < unknownNames.length; i++) {
    const ctxDouble = { ...zeroCtx, [unknownNames[i]]: new Complex(2, 0) };
    const actualDouble = residual(node, ctxDouble);
    const predictedDouble = coeffs[i].mul(new Complex(2, 0)).add(c);
    if (predictedDouble.sub(actualDouble).abs() > LINEARITY_TOLERANCE) {
      throw new Error(
        `La ecuación ${eqIndex} no parece lineal en "${unknownNames[i]}" (revisa potencias de esa incógnita).`
      );
    }
  }

  return { coeffs, rhs: c.neg() };
}

/**
 * Construye la matriz A y el vector b (A·x = b) para el sistema completo.
 * @param {string[]} equationTexts
 * @param {string[]} unknownNames
 * @param {Record<string, Complex>} knownValues variables conocidas ya resueltas
 * @returns {{ A: Complex[][], b: Complex[] }}
 */
function buildLinearSystem(equationTexts, unknownNames, knownValues) {
  const knownCtx = { ...reservedContext(), ...knownValues };
  const A = [];
  const b = [];

  equationTexts.forEach((text, idx) => {
    let node;
    try {
      node = parseEquation(text);
    } catch (e) {
      throw new Error(`Ecuación ${idx + 1}: ${e.message}`);
    }
    try {
      const { coeffs, rhs } = probeEquation(node, unknownNames, knownCtx, idx + 1);
      A.push(coeffs);
      b.push(rhs);
    } catch (e) {
      throw new Error(e.message);
    }
  });

  return { A, b };
}

/**
 * Eliminación gaussiana con pivoteo parcial (por magnitud) sobre Complex.
 * @param {Complex[][]} A matriz n×n
 * @param {Complex[]} b vector n
 * @returns {Complex[]} vector solución x tal que A·x = b
 */
function solveComplexLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxAbs = M[col][col].abs();
    for (let r = col + 1; r < n; r++) {
      const a = M[r][col].abs();
      if (a > maxAbs) {
        maxAbs = a;
        maxRow = r;
      }
    }
    if (maxAbs < 1e-10) {
      throw new Error("El sistema no tiene solución única (matriz singular o casi singular).");
    }
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col].div(pivot);
      for (let c = col; c <= n; c++) {
        M[r][c] = M[r][c].sub(factor.mul(M[col][c]));
      }
    }
  }

  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum = sum.sub(M[i][j].mul(x[j]));
    }
    x[i] = sum.div(M[i][i]);
  }
  return x;
}
