// levels.js — Puzzle level definitions

import { parse } from './proposition.js';

// Helper: parse assumptions and goal from strings
function level(config) {
  return {
    ...config,
    assumptions: (config.assumptions || []).map(s => parse(s)),
    goal: parse(config.goal),
  };
}

// Rule sets (cumulative)
const ARROW = [
  'implies_intro', 'implies_intro_close', 'implies_elim', 'reiteration',
];
const WEDGE = [
  ...ARROW, 'and_intro', 'and_elim_left', 'and_elim_right',
];
const VEE = [
  ...WEDGE,
  'or_intro_left', 'or_intro_right',
  'or_elim', 'or_elim_close_left', 'or_elim_close_right',
];
const NEGATION = [
  ...VEE,
  'not_intro', 'not_intro_close', 'not_elim', 'bottom_elim',
];
const CLASSICAL = [
  ...NEGATION, 'double_neg_elim',
];

export const WORLDS = [
  {
    id: 'arrow',
    name: 'The Arrow',
    symbol: '\u2192',
    description: 'Implication: assume and derive',
  },
  {
    id: 'wedge',
    name: 'The Wedge',
    symbol: '\u2227',
    description: 'Conjunction: combine and separate',
  },
  {
    id: 'vee',
    name: 'The Vee',
    symbol: '\u2228',
    description: 'Disjunction: consider every case',
  },
  {
    id: 'negation',
    name: 'The Contradiction',
    symbol: '\u00AC',
    description: 'Negation: reason by absurdity',
  },
  {
    id: 'classical',
    name: 'Classical Reasoning',
    symbol: '\u00AC\u00AC',
    description: 'Double negation: what must be, is',
  },
];

export const LEVELS = [
  // ── WORLD 1: THE ARROW ──────────────────────────────

  level({
    id: 'identity',
    world: 'arrow',
    name: 'Identity',
    description: 'The simplest theorem: everything implies itself. Assume P, and you already have it.',
    hint: 'Use \u2192I to assume P, then you already have what you need.',
    goal: 'P -> P',
    allowedRules: ARROW,
  }),

  level({
    id: 'detachment',
    world: 'arrow',
    name: 'Detachment',
    description: 'If you know P is true, and you know P implies Q, then Q must be true. This is modus ponens \u2014 the most fundamental rule of reasoning.',
    hint: 'Apply \u2192E (modus ponens) using P and P \u2192 Q.',
    assumptions: ['P', 'P -> Q'],
    goal: 'Q',
    allowedRules: ARROW,
  }),

  level({
    id: 'chain',
    world: 'arrow',
    name: 'Chain Reaction',
    description: 'If P leads to Q, and Q leads to R, then P leads to R. Build the bridge.',
    hint: 'Assume P with \u2192I, then use \u2192E twice to reach R.',
    assumptions: ['P -> Q', 'Q -> R'],
    goal: 'P -> R',
    allowedRules: ARROW,
  }),

  level({
    id: 'composition',
    world: 'arrow',
    name: 'Composition',
    description: 'Prove that implication chains can be built from scratch \u2014 no givens, pure logic.',
    hint: 'Three nested \u2192I assumptions. In the innermost scope, use \u2192E twice.',
    goal: '(P -> Q) -> (Q -> R) -> P -> R',
    allowedRules: ARROW,
  }),

  // ── WORLD 2: THE WEDGE ──────────────────────────────

  level({
    id: 'split',
    world: 'wedge',
    name: 'Split',
    description: 'A conjunction holds both parts. Extract what you need.',
    hint: 'Use \u2227E\u2097 to extract the left side of P \u2227 Q.',
    assumptions: ['P & Q'],
    goal: 'P',
    allowedRules: WEDGE,
  }),

  level({
    id: 'combine',
    world: 'wedge',
    name: 'Combine',
    description: 'If you have both pieces, you can put them together.',
    hint: 'Use \u2227I with P and Q.',
    assumptions: ['P', 'Q'],
    goal: 'P & Q',
    allowedRules: WEDGE,
  }),

  level({
    id: 'swap',
    world: 'wedge',
    name: 'Swap',
    description: 'And is symmetric: P \u2227 Q is the same as Q \u2227 P. Prove it.',
    hint: 'Assume P \u2227 Q, extract both parts, recombine in reverse order.',
    goal: 'P & Q -> Q & P',
    allowedRules: WEDGE,
  }),

  level({
    id: 'pair',
    world: 'wedge',
    name: 'Pair',
    description: 'Build a conjunction from two separate assumptions using currying.',
    hint: 'Assume P, then assume Q, then combine them.',
    goal: 'P -> Q -> P & Q',
    allowedRules: WEDGE,
  }),

  level({
    id: 'regroup',
    world: 'wedge',
    name: 'Regroup',
    description: 'Conjunction is associative. Rearrange the parentheses.',
    hint: 'Extract all three parts (P, Q, R), then recombine with new grouping.',
    goal: '(P & Q) & R -> P & (Q & R)',
    allowedRules: WEDGE,
  }),

  // ── WORLD 3: THE VEE ────────────────────────────────

  level({
    id: 'widen',
    world: 'vee',
    name: 'Widen',
    description: 'If something is true, then it or anything else is true.',
    hint: 'Assume P, then use \u2228I\u2097 to form P \u2228 Q.',
    goal: 'P -> P | Q',
    allowedRules: VEE,
  }),

  level({
    id: 'flip',
    world: 'vee',
    name: 'Flip',
    description: 'Or is symmetric, but proving it requires case analysis.',
    hint: 'Assume P \u2228 Q, then use \u2228E: in each case, introduce the flipped disjunction.',
    goal: 'P | Q -> Q | P',
    allowedRules: VEE,
  }),

  level({
    id: 'cases',
    world: 'vee',
    name: 'Cases',
    description: 'If both roads lead to Rome, and you\'re on one of them, you\'re going to Rome.',
    hint: 'Apply \u2228E to the disjunction, using \u2192E in each case.',
    assumptions: ['P | Q', 'P -> R', 'Q -> R'],
    goal: 'R',
    allowedRules: VEE,
  }),

  level({
    id: 'factor',
    world: 'vee',
    name: 'Factor',
    description: 'Package case analysis into a single implication.',
    hint: 'Three nested assumptions, then \u2228E with \u2192E in each branch.',
    goal: '(P -> R) -> (Q -> R) -> P | Q -> R',
    allowedRules: VEE,
  }),

  // ── WORLD 4: THE CONTRADICTION ──────────────────────

  level({
    id: 'clash',
    world: 'negation',
    name: 'Clash',
    description: 'A proposition and its negation cannot coexist. Together they produce absurdity.',
    hint: 'Use \u00ACE on P and \u00ACP to derive \u22A5.',
    assumptions: ['P', '~P'],
    goal: '#',
    allowedRules: NEGATION,
  }),

  level({
    id: 'absurd',
    world: 'negation',
    name: 'Absurd',
    description: 'From a contradiction, anything follows. This is the principle of explosion.',
    hint: 'Use \u22A5E on the contradiction, specifying P as the conclusion.',
    assumptions: ['#'],
    goal: 'P',
    allowedRules: NEGATION,
  }),

  level({
    id: 'tollens',
    world: 'negation',
    name: 'Tollens',
    description: 'If P implies Q, and Q is false, then P must be false. Contrapositive reasoning.',
    hint: 'Use \u00ACI: assume P, derive Q via \u2192E, then \u00ACE to get \u22A5.',
    assumptions: ['P -> Q', '~Q'],
    goal: '~P',
    allowedRules: NEGATION,
  }),

  level({
    id: 'shield',
    world: 'negation',
    name: 'Shield',
    description: 'Everything implies its own double negation. Truth protects itself.',
    hint: 'Assume P, then start \u00ACI by assuming \u00ACP, then \u00ACE.',
    goal: 'P -> ~~P',
    allowedRules: NEGATION,
  }),

  level({
    id: 'contrapositive',
    world: 'negation',
    name: 'Contrapositive',
    description: 'The contrapositive of an implication. A deep connection between implication and negation.',
    hint: 'Assume P \u2192 Q, then \u00ACQ, then \u00ACI assuming P.',
    goal: '(P -> Q) -> ~Q -> ~P',
    allowedRules: NEGATION,
  }),

  // ── WORLD 5: CLASSICAL REASONING ────────────────────

  level({
    id: 'unveil',
    world: 'classical',
    name: 'Unveil',
    description: 'What is not false must be true. Double negation elimination is the key to classical logic.',
    hint: 'Apply \u00AC\u00ACE directly to \u00AC\u00ACP.',
    assumptions: ['~~P'],
    goal: 'P',
    allowedRules: CLASSICAL,
  }),

  level({
    id: 'excluded_middle',
    world: 'classical',
    name: 'Excluded Middle',
    description: 'Every proposition is either true or false. The crown jewel of classical logic. This is the hardest proof in the game.',
    hint: 'Use \u00ACI to assume \u00AC(P \u2228 \u00ACP). Inside, use \u00ACI to assume P, derive P \u2228 \u00ACP, then contradiction. This gives \u00ACP. Then derive P \u2228 \u00ACP again, contradiction. Close outer \u00ACI for \u00AC\u00AC(P \u2228 \u00ACP). Use \u00AC\u00ACE.',
    goal: 'P | ~P',
    allowedRules: CLASSICAL,
  }),
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}

export function getLevelsByWorld(worldId) {
  return LEVELS.filter(l => l.world === worldId);
}

export function getWorld(id) {
  return WORLDS.find(w => w.id === id) || null;
}

export function getLevelIndex(id) {
  return LEVELS.findIndex(l => l.id === id);
}

export function getNextLevel(currentId) {
  const idx = getLevelIndex(currentId);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}
