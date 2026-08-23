/**
 * integral.js — Integración numérica de ∫ₐᵇ f(t) dt, donde f puede tomar
 * valores complejos (usa `j`) pero t (la variable de integración) y los
 * límites a, b son reales. No hay integración simbólica: se usa cuadratura
 * de Simpson adaptativa (Gander–Gautschi) sobre la parte real e imaginaria
 * por separado, reutilizando el mismo parser/evaluador que el resto de la
 * aplicación.
 */

/**
 * Cuadratura de Simpson adaptativa para una función real de variable real.
 * @param {(t:number)=>number} f
 * @param {number} a
 * @param {number} b
 * @param {number} tol tolerancia de error absoluto
 * @param {number} maxDepth profundidad máxima de subdivisión recursiva
 * @returns {number}
 */
function adaptiveSimpsonReal(f, a, b, tol = 1e-8, maxDepth = 24) {
  function simpson(fa, fc, fb, a, b) {
    return ((b - a) / 6) * (fa + 4 * fc + fb);
  }

  function recurse(a, b, fa, fb, fc, whole, tol, depth) {
    const c = (a + b) / 2;
    const d = (a + c) / 2;
    const e = (c + b) / 2;
    const fd = f(d);
    const fe = f(e);
    const left = simpson(fa, fd, fc, a, c);
    const right = simpson(fc, fe, fb, c, b);
    const combined = left + right;

    if (depth <= 0 || Math.abs(combined - whole) <= 15 * tol) {
      return combined + (combined - whole) / 15;
    }
    return (
      recurse(a, c, fa, fc, fd, left, tol / 2, depth - 1) +
      recurse(c, b, fc, fb, fe, right, tol / 2, depth - 1)
    );
  }

  const fa = f(a);
  const fb = f(b);
  const c = (a + b) / 2;
  const fc = f(c);
  const whole = simpson(fa, fc, fb, a, b);
  return recurse(a, b, fa, fb, fc, whole, tol, maxDepth);
}

/**
 * Integra numéricamente ∫ₗₒwₑᵣ^upper expr(t) dt.
 * @param {object} node AST de la expresión (de parseEquation, sin '=')
 * @param {string} varName nombre de la variable de integración
 * @param {number} lower límite inferior (real)
 * @param {number} upper límite superior (real)
 * @param {Record<string, Complex>} ctx variables conocidas + reservadas (sin `varName`)
 * @returns {Complex}
 */
function integrateExpression(node, varName, lower, upper, ctx) {
  if (node.type === "eq") {
    throw new Error("La expresión a integrar no debe contener '=' (no es una ecuación, es f(x)).");
  }

  const evalAt = (t) => {
    const full = { ...ctx, [varName]: new Complex(t, 0) };
    try {
      return evaluate(node, full);
    } catch (e) {
      throw new Error(`No se pudo evaluar la expresión en ${varName} = ${t}: ${e.message}`);
    }
  };

  if (lower === upper) return new Complex(0, 0);

  const sign = lower > upper ? -1 : 1;
  const lo = Math.min(lower, upper);
  const hi = Math.max(lower, upper);

  const reFn = (t) => evalAt(t).re;
  const imFn = (t) => evalAt(t).im;

  const reResult = adaptiveSimpsonReal(reFn, lo, hi) * sign;
  const imResult = adaptiveSimpsonReal(imFn, lo, hi) * sign;

  return new Complex(reResult, imResult);
}
