// proof.js — Fitch-style proof state management

import { equal, format } from './proposition.js';

// A proof is a sequence of lines, each in a scope.
// Scopes nest: →-intro and ¬-intro open sub-proofs.
//
// ProofLine = {
//   id: number,
//   proposition: Prop,
//   justification: { type, rule?, refs?, scopeRef? },
//   scopeDepth: number,
//   scopeId: number
// }
//
// Scope = {
//   id: number,
//   depth: number,
//   parentId: number | null,
//   assumption: Prop,         -- what was assumed
//   startLine: number,        -- first line id in this scope
//   closed: boolean,
//   closedByLine: number | null,
//   ruleType: string           -- 'implies_intro' | 'not_intro' | 'or_elim_left' | 'or_elim_right'
// }

let nextLineId = 1;
let nextScopeId = 1;

export function createProof(assumptions, goal) {
  nextLineId = 1;
  nextScopeId = 1;

  const proof = {
    lines: [],
    scopes: [],
    currentScopeId: 0, // 0 = root scope
    currentScopeDepth: 0,
    goal,
    history: [], // for undo
    complete: false,
  };

  // Root scope (id=0) is implicit
  // Add given assumptions as lines
  for (const prop of assumptions) {
    proof.lines.push({
      id: nextLineId++,
      proposition: prop,
      justification: { type: 'given' },
      scopeDepth: 0,
      scopeId: 0,
    });
  }

  return proof;
}

// Save state for undo
function saveState(proof) {
  proof.history.push({
    lines: proof.lines.map(l => ({ ...l })),
    scopes: proof.scopes.map(s => ({ ...s })),
    currentScopeId: proof.currentScopeId,
    currentScopeDepth: proof.currentScopeDepth,
    complete: proof.complete,
    nextLineId,
    nextScopeId,
  });
}

export function undo(proof) {
  if (proof.history.length === 0) return false;
  const state = proof.history.pop();
  proof.lines = state.lines;
  proof.scopes = state.scopes;
  proof.currentScopeId = state.currentScopeId;
  proof.currentScopeDepth = state.currentScopeDepth;
  proof.complete = state.complete;
  nextLineId = state.nextLineId;
  nextScopeId = state.nextScopeId;
  return true;
}

// Get lines visible in the current scope (includes parent scopes, excludes closed sub-scopes)
export function visibleLines(proof) {
  const currentDepth = proof.currentScopeDepth;
  const currentScope = proof.currentScopeId;

  // Build set of ancestor scope IDs
  const ancestorScopes = new Set([0, currentScope]);
  let sid = currentScope;
  while (sid !== 0) {
    const scope = proof.scopes.find(s => s.id === sid);
    if (!scope) break;
    sid = scope.parentId ?? 0;
    ancestorScopes.add(sid);
  }

  return proof.lines.filter(line => {
    // Line must be in current scope or an ancestor scope
    if (!ancestorScopes.has(line.scopeId)) return false;
    // Line must not be in a closed sub-scope that isn't an ancestor
    return true;
  });
}

// Open a new sub-proof scope (for →-intro, ¬-intro, etc.)
export function openScope(proof, assumption, ruleType) {
  saveState(proof);

  const scopeId = nextScopeId++;
  const depth = proof.currentScopeDepth + 1;

  proof.scopes.push({
    id: scopeId,
    depth,
    parentId: proof.currentScopeId,
    assumption,
    startLine: nextLineId,
    closed: false,
    closedByLine: null,
    ruleType,
  });

  proof.currentScopeId = scopeId;
  proof.currentScopeDepth = depth;

  // Add assumption as a line
  const line = {
    id: nextLineId++,
    proposition: assumption,
    justification: { type: 'assumption' },
    scopeDepth: depth,
    scopeId,
  };
  proof.lines.push(line);

  return { scopeId, lineId: line.id };
}

// Close the current scope (returns the scope that was closed)
export function closeScope(proof, conclusion, justification) {
  saveState(proof);

  const scope = proof.scopes.find(s => s.id === proof.currentScopeId);
  if (!scope) throw new Error('No scope to close');

  scope.closed = true;
  scope.closedByLine = nextLineId;

  // Return to parent scope
  proof.currentScopeId = scope.parentId ?? 0;
  proof.currentScopeDepth = scope.depth - 1;

  // Add the conclusion line in the parent scope
  const line = {
    id: nextLineId++,
    proposition: conclusion,
    justification,
    scopeDepth: proof.currentScopeDepth,
    scopeId: proof.currentScopeId,
  };
  proof.lines.push(line);

  // Check if proof is complete
  if (proof.currentScopeId === 0 && equal(conclusion, proof.goal)) {
    proof.complete = true;
  }

  return { line, scope };
}

// Add a derived line in the current scope
export function addLine(proof, proposition, justification) {
  saveState(proof);

  const line = {
    id: nextLineId++,
    proposition,
    justification,
    scopeDepth: proof.currentScopeDepth,
    scopeId: proof.currentScopeId,
  };
  proof.lines.push(line);

  // Check if proof is complete
  if (proof.currentScopeId === 0 && equal(proposition, proof.goal)) {
    proof.complete = true;
  }

  return line;
}

// Get a line by ID
export function getLine(proof, lineId) {
  return proof.lines.find(l => l.id === lineId) || null;
}

// Check if a line is accessible from the current scope
export function isAccessible(proof, lineId) {
  const line = getLine(proof, lineId);
  if (!line) return false;

  // Build ancestor chain for current scope
  const ancestors = new Set([0, proof.currentScopeId]);
  let sid = proof.currentScopeId;
  while (sid !== 0) {
    const scope = proof.scopes.find(s => s.id === sid);
    if (!scope) break;
    sid = scope.parentId ?? 0;
    ancestors.add(sid);
  }

  // Line must be in an ancestor scope AND that scope must not be closed
  // (unless it's the same scope or a parent)
  if (!ancestors.has(line.scopeId)) return false;

  // Check line's scope isn't closed (unless it's a parent of current)
  if (line.scopeId !== proof.currentScopeId && line.scopeId !== 0) {
    const lineScope = proof.scopes.find(s => s.id === line.scopeId);
    if (lineScope && lineScope.closed) return false;
  }

  return true;
}

// Get current scope info
export function getCurrentScope(proof) {
  if (proof.currentScopeId === 0) return null;
  return proof.scopes.find(s => s.id === proof.currentScopeId) || null;
}

// Get scope nesting for display
export function getScopeRanges(proof) {
  return proof.scopes.map(scope => {
    const endLine = scope.closedByLine
      ? scope.closedByLine - 1
      : proof.lines[proof.lines.length - 1]?.id ?? scope.startLine;
    return {
      id: scope.id,
      depth: scope.depth,
      startLine: scope.startLine,
      endLine,
      closed: scope.closed,
      ruleType: scope.ruleType,
    };
  });
}

// Reset the proof to initial state
export function resetProof(proof) {
  const assumptions = proof.lines
    .filter(l => l.justification.type === 'given')
    .map(l => l.proposition);

  const fresh = createProof(assumptions, proof.goal);
  Object.assign(proof, fresh);
  return proof;
}

// Format a justification for display
export function formatJustification(just) {
  switch (just.type) {
    case 'given': return 'Given';
    case 'assumption': return 'Assume';
    case 'rule': {
      const ruleNames = {
        'and_intro': '\u2227I',
        'and_elim_left': '\u2227E\u2097',
        'and_elim_right': '\u2227E\u1D63',
        'or_intro_left': '\u2228I\u2097',
        'or_intro_right': '\u2228I\u1D63',
        'or_elim': '\u2228E',
        'implies_intro': '\u2192I',
        'implies_elim': '\u2192E',
        'not_intro': '\u00ACI',
        'not_elim': '\u00ACE',
        'bottom_elim': '\u22A5E',
        'double_neg_elim': '\u00AC\u00ACE',
        'reiteration': 'Reit',
      };
      const name = ruleNames[just.rule] || just.rule;
      const refs = just.refs ? just.refs.join(', ') : '';
      const scopeRef = just.scopeRef ? `[${just.scopeRef}]` : '';
      return refs ? `${name} ${refs}${scopeRef}` : `${name}${scopeRef}`;
    }
    default: return just.type;
  }
}
