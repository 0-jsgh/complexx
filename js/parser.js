/**
 * parser.js — Tokenizador + parser recursivo-descendente.
 *
 * Gramática soportada:
 *   ecuacion   := aditiva ('=' aditiva)?          // sin '=' se asume "= 0"
 *   aditiva    := termino (('+'|'-') termino)*
 *   termino    := unario ( ('*'|'/') unario | &'(' unario )*   // '(' sin operador = mult. implícita
 *   unario     := ('+'|'-') unario | potencia
 *   potencia   := primario ('^' unario)?
 *   primario   := NUM | IDENT | '\pi' | '(' aditiva ')' | FUNC '{' aditiva '}'
 *
 * Reservados: `e` (Euler), `j` (unidad imaginaria) — no son válidos como
 * nombres de variable definidos por el usuario.
 * Funciones LaTeX soportadas: \ln{...}, \sqrt{...}, \exp{...}, \log_B{...}
 * (B = base numérica entera), y la constante \pi.
 */

class ParseError extends Error {}

const TRIG_HYPERBOLIC_FUNCS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc",
  "asin", "acos", "atan", "acot", "asec", "acsc",
  "sinh", "cosh", "tanh", "coth", "sech", "csch",
  "asinh", "acosh", "atanh", "acoth", "asech", "acsch",
]);

function tokenize(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  const isDigit = (c) => c >= "0" && c <= "9";
  const isAlpha = (c) => /[A-Za-z]/.test(c);

  while (i < n) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      const start = i;
      while (i < n && isDigit(src[i])) i++;
      if (src[i] === ".") {
        i++;
        while (i < n && isDigit(src[i])) i++;
      }
      tokens.push({ type: "NUM", value: parseFloat(src.slice(start, i)) });
      continue;
    }

    if (c === "\\") {
      i++;
      const start = i;
      while (i < n && isAlpha(src[i])) i++;
      const name = src.slice(start, i);
      if (!name) throw new ParseError(`Se esperaba un comando después de "\\" (posición ${start}).`);

      if (name === "pi") {
        tokens.push({ type: "CONST", name: "pi" });
      } else if (name === "log") {
        if (src[i] !== "_") {
          throw new ParseError('Falta la base en "\\log": escribe \\log_10{...} (por ejemplo).');
        }
        i++;
        const bstart = i;
        while (i < n && isDigit(src[i])) i++;
        if (i === bstart) throw new ParseError('Se esperaba una base numérica después de "\\log_".');
        const base = parseInt(src.slice(bstart, i), 10);
        tokens.push({ type: "FUNC", name: "log", base });
      } else if (name === "ln" || name === "sqrt" || name === "exp" || TRIG_HYPERBOLIC_FUNCS.has(name)) {
        tokens.push({ type: "FUNC", name });
      } else {
        throw new ParseError(`Comando LaTeX no reconocido: "\\${name}".`);
      }
      continue;
    }

    if (isAlpha(c)) {
      const start = i;
      i++;
      while (i < n && /[A-Za-z0-9]/.test(src[i])) i++;
      tokens.push({ type: "IDENT", name: src.slice(start, i) });
      continue;
    }

    switch (c) {
      case "+":
        tokens.push({ type: "PLUS" });
        i++;
        continue;
      case "-":
        tokens.push({ type: "MINUS" });
        i++;
        continue;
      case "*":
        tokens.push({ type: "STAR" });
        i++;
        continue;
      case "/":
        tokens.push({ type: "SLASH" });
        i++;
        continue;
      case "^":
        tokens.push({ type: "CARET" });
        i++;
        continue;
      case "(":
        tokens.push({ type: "LPAREN" });
        i++;
        continue;
      case ")":
        tokens.push({ type: "RPAREN" });
        i++;
        continue;
      case "{":
        tokens.push({ type: "LBRACE" });
        i++;
        continue;
      case "}":
        tokens.push({ type: "RBRACE" });
        i++;
        continue;
      case "=":
        tokens.push({ type: "EQUALS" });
        i++;
        continue;
      default:
        throw new ParseError(`Carácter no reconocido: "${c}" (posición ${i}).`);
    }
  }

  tokens.push({ type: "EOF" });
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  next() {
    return this.tokens[this.pos++];
  }

  expect(type, hint) {
    const t = this.next();
    if (t.type !== type) {
      throw new ParseError(`Se esperaba "${hint || type}" pero se encontró "${t.type}".`);
    }
    return t;
  }

  parseEquation() {
    const left = this.parseAdditive();
    let node;
    if (this.peek().type === "EQUALS") {
      this.next();
      const right = this.parseAdditive();
      node = { type: "eq", left, right };
    } else {
      node = left; // sin '=' → se asume "= 0"
    }
    if (this.peek().type !== "EOF") {
      throw new ParseError(`Texto inesperado al final de la expresión (cerca de "${this.peek().type}").`);
    }
    return node;
  }

  parseAdditive() {
    let node = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t.type === "PLUS" || t.type === "MINUS") {
        this.next();
        const right = this.parseTerm();
        node = { type: "binop", op: t.type === "PLUS" ? "+" : "-", left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  parseTerm() {
    let node = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t.type === "STAR" || t.type === "SLASH") {
        this.next();
        const right = this.parseUnary();
        node = { type: "binop", op: t.type === "STAR" ? "*" : "/", left: node, right };
      } else if (t.type === "LPAREN" || t.type === "LBRACE" || t.type === "CONST" || t.type === "FUNC") {
        // Multiplicación implícita: término seguido directamente de '(' o '{',
        // de una constante \pi o de una función \ln, \sin, etc. (ej. 2\pi, 3\sin(x)).
        const right = this.parseUnary();
        node = { type: "binop", op: "*", left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  parseUnary() {
    const t = this.peek();
    if (t.type === "PLUS") {
      this.next();
      return this.parseUnary();
    }
    if (t.type === "MINUS") {
      this.next();
      return { type: "neg", arg: this.parseUnary() };
    }
    return this.parsePower();
  }

  parsePower() {
    const base = this.parsePrimary();
    if (this.peek().type === "CARET") {
      this.next();
      const exp = this.parseUnary();
      return { type: "pow", base, exp };
    }
    return base;
  }

  parsePrimary() {
    const t = this.peek();
    if (t.type === "NUM") {
      this.next();
      return { type: "num", value: t.value };
    }
    if (t.type === "IDENT") {
      this.next();
      return { type: "var", name: t.name };
    }
    if (t.type === "CONST") {
      this.next();
      return { type: "const", name: t.name };
    }
    if (t.type === "LPAREN") {
      this.next();
      const node = this.parseAdditive();
      this.expect("RPAREN", ")");
      return node;
    }
    if (t.type === "LBRACE") {
      // '{...}' como agrupador genérico (ej. exponentes en LaTeX: e^{-100*a}).
      this.next();
      const node = this.parseAdditive();
      this.expect("RBRACE", "}");
      return node;
    }
    if (t.type === "FUNC") {
      this.next();
      // Se acepta tanto \ln{x} (llaves, forma LaTeX) como \ln(x) (paréntesis).
      const opening = this.peek().type;
      let closing;
      if (opening === "LBRACE") {
        this.next();
        closing = "RBRACE";
      } else if (opening === "LPAREN") {
        this.next();
        closing = "RPAREN";
      } else {
        throw new ParseError(`Se esperaba "{" o "(" después de la función y se encontró "${opening}".`);
      }
      const arg = this.parseAdditive();
      this.expect(closing, closing === "RBRACE" ? "}" : ")");
      return t.name === "log" ? { type: "func", name: "log", base: t.base, arg } : { type: "func", name: t.name, arg };
    }
    throw new ParseError(`Se esperaba un número, variable o "(" y se encontró "${t.type}".`);
  }
}

/**
 * Analiza una cadena y devuelve el AST de la ecuación (nodo `eq`, o la
 * expresión directa si no hay "=").
 * @param {string} text
 */
function parseEquation(text) {
  const tokens = tokenize(text);
  const parser = new Parser(tokens);
  return parser.parseEquation();
}

/** Recolecta recursivamente todos los nombres de variable usados en un AST. */
function collectVariableNames(node, out = new Set()) {
  switch (node.type) {
    case "var":
      out.add(node.name);
      break;
    case "neg":
      collectVariableNames(node.arg, out);
      break;
    case "binop":
      collectVariableNames(node.left, out);
      collectVariableNames(node.right, out);
      break;
    case "pow":
      collectVariableNames(node.base, out);
      collectVariableNames(node.exp, out);
      break;
    case "func":
      collectVariableNames(node.arg, out);
      break;
    case "eq":
      collectVariableNames(node.left, out);
      collectVariableNames(node.right, out);
      break;
    // 'num' y 'const' no aportan variables
  }
  return out;
}
