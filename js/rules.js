// rules.js — Natural deduction rules: validation, application, metadata

import { And, Or, Implies, Not, Bottom, equal, format } from './proposition.js';
import { addLine, openScope, closeScope, getLine, isAccessible, getCurrentScope } from './proof.js';

// === Rule Definitions ===
// Each rule has:
//   id: string
//   name: display name
//   symbol: short symbol
//   description: one-line explanation
//   type: 'forward' (derive from facts) | 'scope_open' (start sub-proof) | 'scope_close' (end sub-proof)
//   inputs: what the player needs to select
//   apply(proof, args): applies the rule, returns { success, line?, error? }

export const RULES = {
  // ── AND ──────────────────────────────────────────────

  and_intro: {
    id: 'and_intro',
    name: 'And Introduction',
    symbol: '\u2227I',
    description: 'From A and B, derive A \u2227 B',
    type: 'forward',
    inputs: [
      { label: 'Left conjunct (A)', type: 'line' },
      { label: 'Right conjunct (B)', type: 'line' },
    ],
    apply(proof, { lineIds }) {
      const [aId, bId] = lineIds;
      const a = getLine(proof, aId);
      const b = getLine(proof, bId);
      if (!a || !b) return { success: false, error: 'Invalid line references' };
      if (!isAccessible(proof, aId) || !isAccessible(proof, bId))
        return { success: false, error: 'Lines not accessible in current scope' };
      const prop = And(a.proposition, b.proposition);
      const line = addLine(proof, prop, { type: 'rule', rule: 'and_intro', refs: [aId, bId] });
      return { success: true, line };
    },
  },

  and_elim_left: {
    id: 'and_elim_left',
    name: 'And Elimination (Left)',
    symbol: '\u2227E\u2097',
    description: 'From A \u2227 B, derive A',
    type: 'forward',
    inputs: [{ label: 'Conjunction (A \u2227 B)', type: 'line' }],
    apply(proof, { lineIds }) {
      const [id] = lineIds;
      const line = getLine(proof, id);
      if (!line) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, id)) return { success: false, error: 'Line not accessible' };
      if (line.proposition.type !== 'and')
        return { success: false, error: 'Selected line is not a conjunction' };
      const result = addLine(proof, line.proposition.left, { type: 'rule', rule: 'and_elim_left', refs: [id] });
      return { success: true, line: result };
    },
  },

  and_elim_right: {
    id: 'and_elim_right',
    name: 'And Elimination (Right)',
    symbol: '\u2227E\u1D63',
    description: 'From A \u2227 B, derive B',
    type: 'forward',
    inputs: [{ label: 'Conjunction (A \u2227 B)', type: 'line' }],
    apply(proof, { lineIds }) {
      const [id] = lineIds;
      const line = getLine(proof, id);
      if (!line) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, id)) return { success: false, error: 'Line not accessible' };
      if (line.proposition.type !== 'and')
        return { success: false, error: 'Selected line is not a conjunction' };
      const result = addLine(proof, line.proposition.right, { type: 'rule', rule: 'and_elim_right', refs: [id] });
      return { success: true, line: result };
    },
  },

  // ── IMPLIES ──────────────────────────────────────────

  implies_intro: {
    id: 'implies_intro',
    name: 'Implication Introduction',
    symbol: '\u2192I',
    description: 'Assume A, prove B, then derive A \u2192 B',
    type: 'scope_open',
    inputs: [{ label: 'Antecedent to assume (A)', type: 'proposition' }],
    apply(proof, { proposition }) {
      const result = openScope(proof, proposition, 'implies_intro');
      return { success: true, scopeId: result.scopeId, lineId: result.lineId };
    },
  },

  implies_intro_close: {
    id: 'implies_intro_close',
    name: 'Close Implication',
    symbol: '\u2192I\u2713',
    description: 'Close the current sub-proof to derive A \u2192 B',
    type: 'scope_close',
    inputs: [{ label: 'Consequent line (B)', type: 'line' }],
    apply(proof, { lineIds }) {
      const scope = getCurrentScope(proof);
      if (!scope) return { success: false, error: 'Not in a sub-proof' };
      if (scope.ruleType !== 'implies_intro')
        return { success: false, error: 'Current sub-proof is not for \u2192I' };

      const [bId] = lineIds;
      const bLine = getLine(proof, bId);
      if (!bLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, bId)) return { success: false, error: 'Line not accessible' };

      const conclusion = Implies(scope.assumption, bLine.proposition);
      const result = closeScope(proof, conclusion, {
        type: 'rule', rule: 'implies_intro', refs: [scope.startLine, bId],
      });
      return { success: true, line: result.line };
    },
  },

  implies_elim: {
    id: 'implies_elim',
    name: 'Modus Ponens',
    symbol: '\u2192E',
    description: 'From A and A \u2192 B, derive B',
    type: 'forward',
    inputs: [
      { label: 'Antecedent (A)', type: 'line' },
      { label: 'Implication (A \u2192 B)', type: 'line' },
    ],
    apply(proof, { lineIds }) {
      const [aId, impId] = lineIds;
      const aLine = getLine(proof, aId);
      const impLine = getLine(proof, impId);
      if (!aLine || !impLine) return { success: false, error: 'Invalid line references' };
      if (!isAccessible(proof, aId) || !isAccessible(proof, impId))
        return { success: false, error: 'Lines not accessible' };
      if (impLine.proposition.type !== 'implies')
        return { success: false, error: 'Second line is not an implication' };
      if (!equal(aLine.proposition, impLine.proposition.left))
        return { success: false, error: `${format(aLine.proposition)} does not match the antecedent ${format(impLine.proposition.left)}` };
      const result = addLine(proof, impLine.proposition.right, { type: 'rule', rule: 'implies_elim', refs: [aId, impId] });
      return { success: true, line: result };
    },
  },

  // ── OR ───────────────────────────────────────────────

  or_intro_left: {
    id: 'or_intro_left',
    name: 'Or Introduction (Left)',
    symbol: '\u2228I\u2097',
    description: 'From A, derive A \u2228 B (you choose B)',
    type: 'forward',
    inputs: [
      { label: 'Known fact (A)', type: 'line' },
      { label: 'Other disjunct (B)', type: 'proposition' },
    ],
    apply(proof, { lineIds, proposition }) {
      const [aId] = lineIds;
      const aLine = getLine(proof, aId);
      if (!aLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, aId)) return { success: false, error: 'Line not accessible' };
      const prop = Or(aLine.proposition, proposition);
      const result = addLine(proof, prop, { type: 'rule', rule: 'or_intro_left', refs: [aId] });
      return { success: true, line: result };
    },
  },

  or_intro_right: {
    id: 'or_intro_right',
    name: 'Or Introduction (Right)',
    symbol: '\u2228I\u1D63',
    description: 'From B, derive A \u2228 B (you choose A)',
    type: 'forward',
    inputs: [
      { label: 'Known fact (B)', type: 'line' },
      { label: 'Other disjunct (A)', type: 'proposition' },
    ],
    apply(proof, { lineIds, proposition }) {
      const [bId] = lineIds;
      const bLine = getLine(proof, bId);
      if (!bLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, bId)) return { success: false, error: 'Line not accessible' };
      const prop = Or(proposition, bLine.proposition);
      const result = addLine(proof, prop, { type: 'rule', rule: 'or_intro_right', refs: [bId] });
      return { success: true, line: result };
    },
  },

  or_elim: {
    id: 'or_elim',
    name: 'Or Elimination',
    symbol: '\u2228E',
    description: 'From A \u2228 B, if A\u2192C and B\u2192C (via sub-proofs), derive C',
    type: 'scope_open',
    inputs: [{ label: 'Disjunction (A \u2228 B)', type: 'line' }],
    apply(proof, { lineIds }) {
      const [id] = lineIds;
      const line = getLine(proof, id);
      if (!line) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, id)) return { success: false, error: 'Line not accessible' };
      if (line.proposition.type !== 'or')
        return { success: false, error: 'Selected line is not a disjunction' };
      // Open first sub-proof assuming the left disjunct
      const result = openScope(proof, line.proposition.left, 'or_elim_left');
      // Store the disjunction line id and right disjunct for later
      const scope = proof.scopes.find(s => s.id === result.scopeId);
      scope._orLineId = id;
      scope._rightDisjunct = line.proposition.right;
      return { success: true, scopeId: result.scopeId, lineId: result.lineId, phase: 'left' };
    },
  },

  or_elim_close_left: {
    id: 'or_elim_close_left',
    name: 'Close Left Case',
    symbol: '\u2228E\u2097\u2713',
    description: 'Close the left case of \u2228E, then assume the right disjunct',
    type: 'scope_close',
    inputs: [{ label: 'Conclusion line (C)', type: 'line' }],
    apply(proof, { lineIds }) {
      const scope = getCurrentScope(proof);
      if (!scope) return { success: false, error: 'Not in a sub-proof' };
      if (scope.ruleType !== 'or_elim_left')
        return { success: false, error: 'Not in the left case of \u2228E' };

      const [cId] = lineIds;
      const cLine = getLine(proof, cId);
      if (!cLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, cId)) return { success: false, error: 'Line not accessible' };

      const conclusion = cLine.proposition;
      const orLineId = scope._orLineId;
      const rightDisjunct = scope._rightDisjunct;

      // Close left scope (but don't add conclusion line in parent yet)
      scope.closed = true;
      const leftScopeId = scope.id;
      const leftStart = scope.startLine;

      proof.currentScopeId = scope.parentId ?? 0;
      proof.currentScopeDepth = scope.depth - 1;

      // Open right sub-proof
      const result = openScope(proof, rightDisjunct, 'or_elim_right');
      const rightScope = proof.scopes.find(s => s.id === result.scopeId);
      rightScope._orLineId = orLineId;
      rightScope._leftScopeId = leftScopeId;
      rightScope._leftStart = leftStart;
      rightScope._leftEnd = cId;
      rightScope._conclusion = conclusion;

      return { success: true, scopeId: result.scopeId, lineId: result.lineId, phase: 'right' };
    },
  },

  or_elim_close_right: {
    id: 'or_elim_close_right',
    name: 'Close Right Case',
    symbol: '\u2228E\u1D63\u2713',
    description: 'Close the right case of \u2228E, deriving the conclusion',
    type: 'scope_close',
    inputs: [{ label: 'Conclusion line (C) - must match left case', type: 'line' }],
    apply(proof, { lineIds }) {
      const scope = getCurrentScope(proof);
      if (!scope) return { success: false, error: 'Not in a sub-proof' };
      if (scope.ruleType !== 'or_elim_right')
        return { success: false, error: 'Not in the right case of \u2228E' };

      const [cId] = lineIds;
      const cLine = getLine(proof, cId);
      if (!cLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, cId)) return { success: false, error: 'Line not accessible' };

      if (!equal(cLine.proposition, scope._conclusion))
        return { success: false, error: `Conclusion ${format(cLine.proposition)} doesn't match left case ${format(scope._conclusion)}` };

      const conclusion = scope._conclusion;
      const result = closeScope(proof, conclusion, {
        type: 'rule', rule: 'or_elim',
        refs: [scope._orLineId],
        scopeRef: `${scope._leftStart}-${scope._leftEnd}, ${scope.startLine}-${cId}`,
      });
      return { success: true, line: result.line };
    },
  },

  // ── NOT ──────────────────────────────────────────────

  not_intro: {
    id: 'not_intro',
    name: 'Negation Introduction',
    symbol: '\u00ACI',
    description: 'Assume A, derive \u22A5, then conclude \u00ACA',
    type: 'scope_open',
    inputs: [{ label: 'Proposition to negate (A)', type: 'proposition' }],
    apply(proof, { proposition }) {
      const result = openScope(proof, proposition, 'not_intro');
      return { success: true, scopeId: result.scopeId, lineId: result.lineId };
    },
  },

  not_intro_close: {
    id: 'not_intro_close',
    name: 'Close Negation',
    symbol: '\u00ACI\u2713',
    description: 'Close sub-proof with \u22A5 to derive \u00ACA',
    type: 'scope_close',
    inputs: [{ label: 'Contradiction (\u22A5)', type: 'line' }],
    apply(proof, { lineIds }) {
      const scope = getCurrentScope(proof);
      if (!scope) return { success: false, error: 'Not in a sub-proof' };
      if (scope.ruleType !== 'not_intro')
        return { success: false, error: 'Current sub-proof is not for \u00ACI' };

      const [botId] = lineIds;
      const botLine = getLine(proof, botId);
      if (!botLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, botId)) return { success: false, error: 'Line not accessible' };
      if (botLine.proposition.type !== 'bottom')
        return { success: false, error: 'Selected line is not \u22A5' };

      const conclusion = Not(scope.assumption);
      const result = closeScope(proof, conclusion, {
        type: 'rule', rule: 'not_intro', refs: [scope.startLine, botId],
      });
      return { success: true, line: result.line };
    },
  },

  not_elim: {
    id: 'not_elim',
    name: 'Negation Elimination',
    symbol: '\u00ACE',
    description: 'From A and \u00ACA, derive \u22A5',
    type: 'forward',
    inputs: [
      { label: 'Proposition (A)', type: 'line' },
      { label: 'Its negation (\u00ACA)', type: 'line' },
    ],
    apply(proof, { lineIds }) {
      const [aId, notAId] = lineIds;
      const aLine = getLine(proof, aId);
      const notALine = getLine(proof, notAId);
      if (!aLine || !notALine) return { success: false, error: 'Invalid line references' };
      if (!isAccessible(proof, aId) || !isAccessible(proof, notAId))
        return { success: false, error: 'Lines not accessible' };
      if (notALine.proposition.type !== 'not')
        return { success: false, error: 'Second line is not a negation' };
      if (!equal(aLine.proposition, notALine.proposition.inner))
        return { success: false, error: `${format(aLine.proposition)} is not the negation target of ${format(notALine.proposition)}` };
      const result = addLine(proof, Bottom, { type: 'rule', rule: 'not_elim', refs: [aId, notAId] });
      return { success: true, line: result };
    },
  },

  // ── BOTTOM ───────────────────────────────────────────

  bottom_elim: {
    id: 'bottom_elim',
    name: 'Explosion',
    symbol: '\u22A5E',
    description: 'From \u22A5, derive anything',
    type: 'forward',
    inputs: [
      { label: 'Contradiction (\u22A5)', type: 'line' },
      { label: 'Desired conclusion', type: 'proposition' },
    ],
    apply(proof, { lineIds, proposition }) {
      const [botId] = lineIds;
      const botLine = getLine(proof, botId);
      if (!botLine) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, botId)) return { success: false, error: 'Line not accessible' };
      if (botLine.proposition.type !== 'bottom')
        return { success: false, error: 'Selected line is not \u22A5' };
      const result = addLine(proof, proposition, { type: 'rule', rule: 'bottom_elim', refs: [botId] });
      return { success: true, line: result };
    },
  },

  // ── DOUBLE NEGATION ──────────────────────────────────

  double_neg_elim: {
    id: 'double_neg_elim',
    name: 'Double Negation Elimination',
    symbol: '\u00AC\u00ACE',
    description: 'From \u00AC\u00ACA, derive A',
    type: 'forward',
    inputs: [{ label: 'Double negation (\u00AC\u00ACA)', type: 'line' }],
    apply(proof, { lineIds }) {
      const [id] = lineIds;
      const line = getLine(proof, id);
      if (!line) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, id)) return { success: false, error: 'Line not accessible' };
      const p = line.proposition;
      if (p.type !== 'not' || p.inner.type !== 'not')
        return { success: false, error: 'Selected line is not a double negation' };
      const result = addLine(proof, p.inner.inner, { type: 'rule', rule: 'double_neg_elim', refs: [id] });
      return { success: true, line: result };
    },
  },

  // ── REITERATION ──────────────────────────────────────

  reiteration: {
    id: 'reiteration',
    name: 'Reiteration',
    symbol: 'Reit',
    description: 'Copy an accessible line into the current scope',
    type: 'forward',
    inputs: [{ label: 'Line to reiterate', type: 'line' }],
    apply(proof, { lineIds }) {
      const [id] = lineIds;
      const line = getLine(proof, id);
      if (!line) return { success: false, error: 'Invalid line reference' };
      if (!isAccessible(proof, id)) return { success: false, error: 'Line not accessible' };
      const result = addLine(proof, line.proposition, { type: 'rule', rule: 'reiteration', refs: [id] });
      return { success: true, line: result };
    },
  },
};

// Get rule by ID
export function getRule(id) {
  return RULES[id] || null;
}

// Get all rules as array
export function allRules() {
  return Object.values(RULES);
}

// Get rules available for a given level (filtered by allowedRules list)
export function availableRules(allowedRuleIds) {
  if (!allowedRuleIds) return allRules();
  return allowedRuleIds.map(id => RULES[id]).filter(Boolean);
}

// Get forward rules only
export function forwardRules(allowedRuleIds) {
  return availableRules(allowedRuleIds).filter(r => r.type === 'forward');
}

// Get scope-opening rules only
export function scopeOpenRules(allowedRuleIds) {
  return availableRules(allowedRuleIds).filter(r => r.type === 'scope_open');
}

// Get scope-closing rules matching current scope
export function scopeCloseRules(proof, allowedRuleIds) {
  const scope = getCurrentScope(proof);
  if (!scope) return [];
  const rules = availableRules(allowedRuleIds).filter(r => r.type === 'scope_close');
  // Filter to rules matching the current scope type
  return rules.filter(r => {
    if (r.id === 'implies_intro_close') return scope.ruleType === 'implies_intro';
    if (r.id === 'not_intro_close') return scope.ruleType === 'not_intro';
    if (r.id === 'or_elim_close_left') return scope.ruleType === 'or_elim_left';
    if (r.id === 'or_elim_close_right') return scope.ruleType === 'or_elim_right';
    return false;
  });
}
