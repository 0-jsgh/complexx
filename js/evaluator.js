/**
 * evaluator.js — Evalúa un AST (de parser.js) a un Complex, dado un
 * contexto { nombre: Complex }.
 */

/**
 * Evalúa un nodo de expresión (no de tipo 'eq').
 * @param {object} node
 * @param {Record<string, Complex>} ctx
 * @returns {Complex}
 */
function evaluate(node, ctx) {
  switch (node.type) {
    case "num":
      return new Complex(node.value, 0);

    case "const":
      if (node.name === "pi") return new Complex(Math.PI, 0);
      throw new EvalError(`Constante desconocida: "${node.name}".`);

    case "var": {
      const v = ctx[node.name];
      if (v === undefined) throw new EvalError(`Variable no definida: "${node.name}".`);
      return v;
    }

    case "neg":
      return evaluate(node.arg, ctx).neg();

    case "binop": {
      const l = evaluate(node.left, ctx);
      const r = evaluate(node.right, ctx);
      switch (node.op) {
        case "+":
          return l.add(r);
        case "-":
          return l.sub(r);
        case "*":
          return l.mul(r);
        case "/":
          if (r.isZero()) throw new EvalError("División entre cero.");
          return l.div(r);
        default:
          throw new EvalError(`Operador desconocido: "${node.op}".`);
      }
    }

    case "pow":
      return Complex.pow(evaluate(node.base, ctx), evaluate(node.exp, ctx));

    case "func": {
      const arg = evaluate(node.arg, ctx);
      switch (node.name) {
        case "ln":
          return arg.ln();
        case "log":
          return arg.logBase(node.base);
        case "sqrt":
          return arg.sqrt();
        case "exp":
          return arg.exp();
        case "sin":
        case "cos":
        case "tan":
        case "cot":
        case "sec":
        case "csc":
        case "asin":
        case "acos":
        case "atan":
        case "acot":
        case "asec":
        case "acsc":
        case "sinh":
        case "cosh":
        case "tanh":
        case "coth":
        case "sech":
        case "csch":
        case "asinh":
        case "acosh":
        case "atanh":
        case "acoth":
        case "asech":
        case "acsch":
          return arg[node.name]();
        default:
          throw new EvalError(`Función desconocida: "${node.name}".`);
      }
    }

    case "eq":
      throw new EvalError("Un nodo de igualdad no se evalúa directamente; usa residual().");

    default:
      throw new EvalError(`Nodo AST desconocido: "${node.type}".`);
  }
}

/**
 * Evalúa el "residual" de una ecuación: lhs - rhs (0 si la ecuación se
 * cumple). Si el nodo no es una igualdad, se asume "= 0" y el residual
 * es la expresión misma.
 * @param {object} node
 * @param {Record<string, Complex>} ctx
 * @returns {Complex}
 */
function residual(node, ctx) {
  if (node.type === "eq") {
    return evaluate(node.left, ctx).sub(evaluate(node.right, ctx));
  }
  return evaluate(node, ctx);
}
