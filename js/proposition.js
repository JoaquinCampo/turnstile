// proposition.js — Proposition types, parser, pretty printer, equality

// === Constructors ===
export const Var = (name) => ({ type: 'var', name });
export const And = (left, right) => ({ type: 'and', left, right });
export const Or = (left, right) => ({ type: 'or', left, right });
export const Implies = (left, right) => ({ type: 'implies', left, right });
export const Not = (inner) => ({ type: 'not', inner });
export const Bottom = Object.freeze({ type: 'bottom' });

// === Equality ===
export function equal(a, b) {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'var': return a.name === b.name;
    case 'and':
    case 'or':
    case 'implies': return equal(a.left, b.left) && equal(a.right, b.right);
    case 'not': return equal(a.inner, b.inner);
    case 'bottom': return true;
    default: return false;
  }
}

// === Pretty Printer ===
// Precedence: implies(1) < or(2) < and(3) < not(4) < atom(5)
function precedence(prop) {
  switch (prop.type) {
    case 'implies': return 1;
    case 'or': return 2;
    case 'and': return 3;
    case 'not': return 4;
    default: return 5;
  }
}

export function format(prop, parentPrec = 0) {
  const prec = precedence(prop);
  let result;
  switch (prop.type) {
    case 'var': result = prop.name; break;
    case 'bottom': result = '\u22A5'; break;
    case 'not': result = '\u00AC' + format(prop.inner, 4); break;
    case 'and': result = format(prop.left, 3) + ' \u2227 ' + format(prop.right, 4); break;
    case 'or': result = format(prop.left, 2) + ' \u2228 ' + format(prop.right, 3); break;
    case 'implies': result = format(prop.left, 2) + ' \u2192 ' + format(prop.right, 1); break;
    default: result = '?';
  }
  return prec < parentPrec ? '(' + result + ')' : result;
}

// === Tokenizer ===
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; }
    else if (ch === ')') { tokens.push({ type: 'rparen' }); i++; }
    else if (ch === '\u2227' || ch === '&') { tokens.push({ type: 'and' }); i++; }
    else if (ch === '/' && input[i + 1] === '\\') { tokens.push({ type: 'and' }); i += 2; }
    else if (ch === '\u2228' || ch === '|') { tokens.push({ type: 'or' }); i++; }
    else if (ch === '\\' && input[i + 1] === '/') { tokens.push({ type: 'or' }); i += 2; }
    else if (ch === '\u2192') { tokens.push({ type: 'implies' }); i++; }
    else if (ch === '-' && input[i + 1] === '>') { tokens.push({ type: 'implies' }); i += 2; }
    else if (ch === '\u00AC' || ch === '~' || ch === '!') { tokens.push({ type: 'not' }); i++; }
    else if (ch === '\u22A5') { tokens.push({ type: 'bottom' }); i++; }
    else if (ch === '#') { tokens.push({ type: 'bottom' }); i++; } // ASCII for bottom
    else if (/[A-Z]/.test(ch)) {
      let name = '';
      while (i < input.length && /[A-Za-z0-9]/.test(input[i])) name += input[i++];
      tokens.push({ type: 'var', value: name });
    }
    else { throw new Error(`Unexpected character: '${ch}'`); }
  }
  return tokens;
}

// === Parser ===
// Grammar (precedence low→high):
//   expr    = implies
//   implies = or ('→' implies)?          right-associative
//   or      = and ('∨' and)*             left-associative
//   and     = unary ('∧' unary)*         left-associative
//   unary   = '¬' unary | atom
//   atom    = VAR | '⊥' | '(' expr ')'

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos] || null; }
  advance() { return this.tokens[this.pos++]; }

  expect(type) {
    const tok = this.advance();
    if (!tok || tok.type !== type) {
      throw new Error(`Expected ${type}, got ${tok ? tok.type : 'end'}`);
    }
    return tok;
  }

  parseExpr() {
    const result = this.parseImplies();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}`);
    }
    return result;
  }

  parseImplies() {
    const left = this.parseOr();
    if (this.peek()?.type === 'implies') {
      this.advance();
      return Implies(left, this.parseImplies());
    }
    return left;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.peek()?.type === 'or') {
      this.advance();
      left = Or(left, this.parseAnd());
    }
    return left;
  }

  parseAnd() {
    let left = this.parseUnary();
    while (this.peek()?.type === 'and') {
      this.advance();
      left = And(left, this.parseUnary());
    }
    return left;
  }

  parseUnary() {
    if (this.peek()?.type === 'not') {
      this.advance();
      return Not(this.parseUnary());
    }
    return this.parseAtom();
  }

  parseAtom() {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of input');
    if (tok.type === 'var') { this.advance(); return Var(tok.value); }
    if (tok.type === 'bottom') { this.advance(); return Bottom; }
    if (tok.type === 'lparen') {
      this.advance();
      const expr = this.parseImplies();
      this.expect('rparen');
      return expr;
    }
    throw new Error(`Unexpected token: ${tok.type}`);
  }
}

export function parse(input) {
  return new Parser(tokenize(input)).parseExpr();
}

// === Utilities ===

// Collect all free variables in a proposition
export function variables(prop) {
  const vars = new Set();
  function walk(p) {
    switch (p.type) {
      case 'var': vars.add(p.name); break;
      case 'and': case 'or': case 'implies': walk(p.left); walk(p.right); break;
      case 'not': walk(p.inner); break;
    }
  }
  walk(prop);
  return vars;
}

// Deep clone a proposition
export function clone(prop) {
  switch (prop.type) {
    case 'var': return Var(prop.name);
    case 'and': return And(clone(prop.left), clone(prop.right));
    case 'or': return Or(clone(prop.left), clone(prop.right));
    case 'implies': return Implies(clone(prop.left), clone(prop.right));
    case 'not': return Not(clone(prop.inner));
    case 'bottom': return Bottom;
    default: return prop;
  }
}
