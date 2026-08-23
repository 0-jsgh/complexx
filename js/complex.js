/**
 * complex.js — Aritmética de números complejos, sin dependencias externas.
 * `j` se usa como unidad imaginaria en toda la aplicación (convención de
 * ingeniería eléctrica), pero esta clase es agnóstica del símbolo usado.
 */
class Complex {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }

  static from(x) {
    if (x instanceof Complex) return x;
    if (typeof x === "number") return new Complex(x, 0);
    throw new TypeError("No se puede convertir a Complex: " + x);
  }

  add(other) {
    const o = Complex.from(other);
    return new Complex(this.re + o.re, this.im + o.im);
  }

  sub(other) {
    const o = Complex.from(other);
    return new Complex(this.re - o.re, this.im - o.im);
  }

  mul(other) {
    const o = Complex.from(other);
    return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re);
  }

  div(other) {
    const o = Complex.from(other);
    const denom = o.re * o.re + o.im * o.im;
    if (denom === 0) throw new EvalError("División entre cero");
    return new Complex((this.re * o.re + this.im * o.im) / denom, (this.im * o.re - this.re * o.im) / denom);
  }

  neg() {
    return new Complex(-this.re, -this.im);
  }

  abs() {
    return Math.hypot(this.re, this.im);
  }

  arg() {
    return Math.atan2(this.im, this.re);
  }

  isZero(eps = 1e-9) {
    return this.abs() < eps;
  }

  /** Logaritmo natural (valor principal). */
  ln() {
    if (this.isZero()) throw new EvalError("ln(0) no está definido");
    return new Complex(Math.log(this.abs()), this.arg());
  }

  /** Logaritmo en base `base` (real, base > 0, base != 1). */
  logBase(base) {
    if (!(base > 0) || base === 1) throw new EvalError(`Base de logaritmo inválida: ${base}`);
    return this.ln().div(new Complex(Math.log(base), 0));
  }

  exp() {
    const r = Math.exp(this.re);
    return new Complex(r * Math.cos(this.im), r * Math.sin(this.im));
  }

  sqrt() {
    const r = Math.sqrt(this.abs());
    const theta = this.arg() / 2;
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  // --- Trigonométricas directas ---
  sin() {
    return new Complex(Math.sin(this.re) * Math.cosh(this.im), Math.cos(this.re) * Math.sinh(this.im));
  }
  cos() {
    return new Complex(Math.cos(this.re) * Math.cosh(this.im), -Math.sin(this.re) * Math.sinh(this.im));
  }
  tan() {
    return this.sin().div(this.cos());
  }
  cot() {
    return this.cos().div(this.sin());
  }
  sec() {
    return Complex.ONE.div(this.cos());
  }
  csc() {
    return Complex.ONE.div(this.sin());
  }

  // --- Trigonométricas inversas (rama principal, vía logaritmo) ---
  asin() {
    const i = new Complex(0, 1);
    const inner = i.mul(this).add(Complex.ONE.sub(this.mul(this)).sqrt());
    return i.neg().mul(inner.ln());
  }
  acos() {
    const i = new Complex(0, 1);
    const inner = this.add(i.mul(Complex.ONE.sub(this.mul(this)).sqrt()));
    return i.neg().mul(inner.ln());
  }
  atan() {
    const i = new Complex(0, 1);
    const num = Complex.ONE.sub(i.mul(this)).ln();
    const den = Complex.ONE.add(i.mul(this)).ln();
    return i.div(new Complex(2, 0)).mul(num.sub(den));
  }
  acot() {
    return Complex.ONE.div(this).atan();
  }
  asec() {
    return Complex.ONE.div(this).acos();
  }
  acsc() {
    return Complex.ONE.div(this).asin();
  }

  // --- Hiperbólicas ---
  sinh() {
    return new Complex(Math.sinh(this.re) * Math.cos(this.im), Math.cosh(this.re) * Math.sin(this.im));
  }
  cosh() {
    return new Complex(Math.cosh(this.re) * Math.cos(this.im), Math.sinh(this.re) * Math.sin(this.im));
  }
  tanh() {
    return this.sinh().div(this.cosh());
  }
  coth() {
    return this.cosh().div(this.sinh());
  }
  sech() {
    return Complex.ONE.div(this.cosh());
  }
  csch() {
    return Complex.ONE.div(this.sinh());
  }

  // --- Hiperbólicas inversas ---
  asinh() {
    return this.add(this.mul(this).add(Complex.ONE).sqrt()).ln();
  }
  acosh() {
    return this.add(this.mul(this).sub(Complex.ONE).sqrt()).ln();
  }
  atanh() {
    const num = Complex.ONE.add(this).ln();
    const den = Complex.ONE.sub(this).ln();
    return num.sub(den).div(new Complex(2, 0));
  }
  acoth() {
    return Complex.ONE.div(this).atanh();
  }
  asech() {
    return Complex.ONE.div(this).acosh();
  }
  acsch() {
    return Complex.ONE.div(this).asinh();
  }

  /** this ** exponent, usando la rama principal para exponentes no enteros. */
  static pow(base, exponent) {
    base = Complex.from(base);
    exponent = Complex.from(exponent);
    if (base.isZero()) {
      if (exponent.im === 0 && exponent.re > 0) return new Complex(0, 0);
      throw new EvalError("0 elevado a un exponente no positivo o complejo no está definido");
    }
    // Caso común: exponente entero pequeño → multiplicación directa (más preciso).
    if (exponent.im === 0 && Number.isInteger(exponent.re) && Math.abs(exponent.re) <= 64) {
      let n = exponent.re;
      const invert = n < 0;
      n = Math.abs(n);
      let result = new Complex(1, 0);
      let b = base;
      while (n > 0) {
        if (n & 1) result = result.mul(b);
        b = b.mul(b);
        n >>= 1;
      }
      return invert ? new Complex(1, 0).div(result) : result;
    }
    return exponent.mul(base.ln()).exp();
  }

  toDisplayString(decimals = 10) {
    const round = (n) => {
      const rounded = parseFloat(n.toFixed(decimals));
      return Object.is(rounded, -0) ? 0 : rounded;
    };
    const re = round(this.re);
    const im = round(this.im);
    if (im === 0) return `${re}`;
    if (re === 0) return `${im}j`;
    return im > 0 ? `${re} + ${im}j` : `${re} - ${-im}j`;
  }
}

Complex.ZERO = new Complex(0, 0);
Complex.ONE = new Complex(1, 0);
