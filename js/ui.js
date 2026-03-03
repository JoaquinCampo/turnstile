// ui.js — DOM rendering and interaction handling

import { format, parse, variables } from './proposition.js';
import { visibleLines, getCurrentScope, formatJustification, getScopeRanges } from './proof.js';
import { RULES, forwardRules, scopeOpenRules, scopeCloseRules, getRule } from './rules.js';
import { LEVELS, WORLDS, getLevelsByWorld } from './levels.js';
import {
  createGame, startLevel, undoMove, resetLevel, completeLevel,
  nextLevel, goToMenu, isLevelUnlocked, getProgress,
} from './game.js';

let game = null;

// Interaction state
let selectedRule = null;
let collectedInputs = { lineIds: [], proposition: null };
let inputStep = 0; // which input we're collecting
let errorMessage = null;
let errorTimeout = null;
let showHint = false;

export function init() {
  game = createGame();
  render();
}

// ── Rendering ─────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  switch (game.screen) {
    case 'menu': renderMenu(app); break;
    case 'level': renderLevel(app); break;
    case 'victory': renderVictory(app); break;
  }
}

function renderMenu(app) {
  const progress = getProgress(game);

  const header = el('header', 'menu-header');
  header.innerHTML = `
    <h1 class="logo">\u22A2 Turnstile</h1>
    <p class="subtitle">A game of formal proof</p>
    <p class="progress-summary">${progress.completed} / ${progress.total} theorems proven</p>
  `;
  app.appendChild(header);

  const worldsContainer = el('div', 'worlds');
  for (const world of WORLDS) {
    const worldLevels = getLevelsByWorld(world.id);
    const worldProgress = progress.worlds.find(w => w.id === world.id);

    const worldEl = el('div', 'world');
    const isWorldLocked = !worldLevels.some(l => isLevelUnlocked(game, l.id));

    const worldHeader = el('div', 'world-header');
    worldHeader.innerHTML = `
      <span class="world-symbol">${world.symbol}</span>
      <div>
        <h2 class="world-name">${world.name}</h2>
        <p class="world-desc">${world.description}</p>
        <p class="world-progress">${worldProgress.completed} / ${worldProgress.total}</p>
      </div>
    `;
    worldEl.appendChild(worldHeader);

    if (!isWorldLocked) {
      const levelList = el('div', 'level-list');
      for (const lvl of worldLevels) {
        const unlocked = isLevelUnlocked(game, lvl.id);
        const completed = game.progress.completedLevels.has(lvl.id);
        const best = game.progress.bestSteps[lvl.id];

        const btn = el('button', `level-btn ${completed ? 'completed' : ''} ${!unlocked ? 'locked' : ''}`);
        btn.innerHTML = `
          <span class="level-status">${completed ? '\u2713' : unlocked ? '\u25CB' : '\u25CF'}</span>
          <span class="level-name">${lvl.name}</span>
          ${best ? `<span class="level-best">${best} lines</span>` : ''}
        `;
        if (unlocked) {
          btn.addEventListener('click', () => {
            clearInteraction();
            startLevel(game, lvl.id);
            render();
          });
        } else {
          btn.disabled = true;
        }
        levelList.appendChild(btn);
      }
      worldEl.appendChild(levelList);
    } else {
      const locked = el('p', 'world-locked');
      locked.textContent = 'Complete previous world to unlock';
      worldEl.appendChild(locked);
    }

    worldsContainer.appendChild(worldEl);
  }
  app.appendChild(worldsContainer);
}

function renderLevel(app) {
  const lvl = game.levelDef;
  const proof = game.proof;

  // Header bar
  const header = el('div', 'level-header');
  const backBtn = el('button', 'back-btn');
  backBtn.textContent = '\u2190';
  backBtn.title = 'Back to menu';
  backBtn.addEventListener('click', () => { clearInteraction(); goToMenu(game); render(); });
  header.appendChild(backBtn);

  const titleEl = el('div', 'level-title-area');
  titleEl.innerHTML = `<h2 class="level-title">${lvl.name}</h2>`;
  header.appendChild(titleEl);
  app.appendChild(header);

  // Goal display
  const goalBar = el('div', 'goal-bar');
  const goalLabel = el('span', 'goal-label');
  goalLabel.textContent = 'Prove:';
  goalBar.appendChild(goalLabel);
  const goalProp = el('span', 'goal-prop');
  goalProp.textContent = format(proof.goal);
  goalBar.appendChild(goalProp);
  app.appendChild(goalBar);

  // Description
  const descEl = el('p', 'level-description');
  descEl.textContent = lvl.description;
  app.appendChild(descEl);

  // Proof area
  const proofArea = el('div', 'proof-area');
  renderProofLines(proofArea, proof, lvl);
  app.appendChild(proofArea);

  // Scope indicator
  const scope = getCurrentScope(proof);
  if (scope) {
    const scopeInfo = el('div', 'scope-info');
    const ruleLabels = {
      'implies_intro': '\u2192I',
      'not_intro': '\u00ACI',
      'or_elim_left': '\u2228E (left case)',
      'or_elim_right': '\u2228E (right case)',
    };
    scopeInfo.innerHTML = `<span class="scope-badge">Sub-proof</span> ${ruleLabels[scope.ruleType] || scope.ruleType}: assuming <strong>${format(scope.assumption)}</strong>`;
    app.appendChild(scopeInfo);
  }

  // Error message
  if (errorMessage) {
    const errEl = el('div', 'error-msg');
    errEl.textContent = errorMessage;
    app.appendChild(errEl);
  }

  // Input prompt
  if (selectedRule) {
    const promptArea = el('div', 'input-prompt');
    renderInputPrompt(promptArea);
    app.appendChild(promptArea);
  }

  // Rule palette
  const palette = el('div', 'rule-palette');
  renderRulePalette(palette, proof, lvl);
  app.appendChild(palette);

  // Controls bar
  const controls = el('div', 'controls-bar');

  const undoBtn = el('button', 'ctrl-btn');
  undoBtn.textContent = 'Undo';
  undoBtn.disabled = proof.history.length === 0;
  undoBtn.addEventListener('click', () => { clearInteraction(); undoMove(game); render(); });
  controls.appendChild(undoBtn);

  const resetBtn = el('button', 'ctrl-btn');
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => { clearInteraction(); resetLevel(game); render(); });
  controls.appendChild(resetBtn);

  const hintBtn = el('button', `ctrl-btn ${showHint ? 'active' : ''}`);
  hintBtn.textContent = showHint ? 'Hide Hint' : 'Hint';
  hintBtn.addEventListener('click', () => { showHint = !showHint; render(); });
  controls.appendChild(hintBtn);

  app.appendChild(controls);

  // Hint area
  if (showHint && lvl.hint) {
    const hintEl = el('div', 'hint-area');
    hintEl.textContent = lvl.hint;
    app.appendChild(hintEl);
  }
}

function renderProofLines(container, proof, lvl) {
  const scopeRanges = getScopeRanges(proof);
  const lines = proof.lines;

  if (lines.length === 0) {
    const empty = el('div', 'proof-empty');
    empty.textContent = 'No lines yet. Choose a rule to begin.';
    container.appendChild(empty);
    return;
  }

  for (const line of lines) {
    const lineEl = el('div', 'proof-line');

    // Determine if this line is selectable (when collecting line inputs)
    const isSelectable = selectedRule && inputStep < selectedRule.inputs.length
      && selectedRule.inputs[inputStep].type === 'line';
    const isSelected = collectedInputs.lineIds.includes(line.id);

    if (isSelectable) lineEl.classList.add('selectable');
    if (isSelected) lineEl.classList.add('selected');

    // Scope depth indicator
    const depthEl = el('div', 'line-depth');
    for (let d = 0; d < line.scopeDepth; d++) {
      const bar = el('span', 'scope-bar');
      depthEl.appendChild(bar);
    }
    lineEl.appendChild(depthEl);

    // Line number
    const numEl = el('span', 'line-num');
    numEl.textContent = line.id;
    lineEl.appendChild(numEl);

    // Proposition
    const propEl = el('span', 'line-prop');
    propEl.textContent = format(line.proposition);
    lineEl.appendChild(propEl);

    // Justification
    const justEl = el('span', 'line-just');
    justEl.textContent = formatJustification(line.justification);
    lineEl.appendChild(justEl);

    // Click handler for line selection
    if (isSelectable) {
      lineEl.addEventListener('click', () => selectLine(line.id));
    }

    container.appendChild(lineEl);
  }
}

function renderRulePalette(container, proof, lvl) {
  const allowedRuleIds = lvl.allowedRules;

  // Forward rules
  const fwd = forwardRules(allowedRuleIds);
  if (fwd.length > 0) {
    const group = el('div', 'rule-group');
    const label = el('span', 'rule-group-label');
    label.textContent = 'Derive';
    group.appendChild(label);
    for (const rule of fwd) {
      group.appendChild(ruleButton(rule));
    }
    container.appendChild(group);
  }

  // Scope open rules
  const open = scopeOpenRules(allowedRuleIds);
  if (open.length > 0) {
    const group = el('div', 'rule-group');
    const label = el('span', 'rule-group-label');
    label.textContent = 'Begin sub-proof';
    group.appendChild(label);
    for (const rule of open) {
      group.appendChild(ruleButton(rule));
    }
    container.appendChild(group);
  }

  // Scope close rules
  const close = scopeCloseRules(proof, allowedRuleIds);
  if (close.length > 0) {
    const group = el('div', 'rule-group');
    const label = el('span', 'rule-group-label');
    label.textContent = 'Close sub-proof';
    group.appendChild(label);
    for (const rule of close) {
      group.appendChild(ruleButton(rule));
    }
    container.appendChild(group);
  }
}

function ruleButton(rule) {
  const btn = el('button', `rule-btn ${selectedRule?.id === rule.id ? 'active' : ''}`);
  btn.innerHTML = `<span class="rule-symbol">${rule.symbol}</span> <span class="rule-name">${rule.name}</span>`;
  btn.title = rule.description;
  btn.addEventListener('click', () => selectRule(rule));
  return btn;
}

function renderInputPrompt(container) {
  const rule = selectedRule;
  if (!rule) return;

  const step = inputStep < rule.inputs.length ? rule.inputs[inputStep] : null;
  if (!step) return;

  const promptText = el('p', 'prompt-text');
  promptText.innerHTML = `<strong>${rule.name}:</strong> ${step.label}`;
  container.appendChild(promptText);

  if (step.type === 'line') {
    const hint = el('p', 'prompt-hint');
    hint.textContent = 'Click a line in the proof above.';
    container.appendChild(hint);
  } else if (step.type === 'proposition') {
    const form = el('div', 'prop-input-form');

    const input = el('input', 'prop-input');
    input.type = 'text';
    input.placeholder = 'Enter proposition (e.g., P, Q, P & Q)';
    input.id = 'prop-input-field';

    // Quick-insert variable buttons
    const vars = variables(game.proof.goal);
    if (vars.size > 0) {
      const quickBtns = el('div', 'quick-vars');
      for (const v of vars) {
        const btn = el('button', 'quick-var-btn');
        btn.textContent = v;
        btn.addEventListener('click', () => {
          const field = document.getElementById('prop-input-field');
          if (field) { field.value += v; field.focus(); }
        });
        quickBtns.appendChild(btn);
      }
      form.appendChild(quickBtns);
    }

    form.appendChild(input);

    const submitBtn = el('button', 'prop-submit-btn');
    submitBtn.textContent = 'Apply';
    submitBtn.addEventListener('click', () => {
      const field = document.getElementById('prop-input-field');
      if (field) submitProposition(field.value);
    });
    form.appendChild(submitBtn);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const field = document.getElementById('prop-input-field');
        if (field) submitProposition(field.value);
      }
    });

    container.appendChild(form);
  }

  const cancelBtn = el('button', 'cancel-btn');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { clearInteraction(); render(); });
  container.appendChild(cancelBtn);
}

function renderVictory(app) {
  const lvl = game.levelDef;
  const proof = game.proof;

  const modal = el('div', 'victory-screen');
  modal.innerHTML = `
    <div class="victory-symbol">\u220E</div>
    <h2 class="victory-title">Q.E.D.</h2>
    <p class="victory-subtitle">${lvl.name} \u2014 proven in ${proof.lines.length} lines</p>
  `;

  // Show the completed proof
  const proofReview = el('div', 'proof-review');
  const proofArea = el('div', 'proof-area compact');
  renderProofLines(proofArea, proof, lvl);
  proofReview.appendChild(proofArea);
  modal.appendChild(proofReview);

  const btnRow = el('div', 'victory-buttons');

  const menuBtn = el('button', 'ctrl-btn');
  menuBtn.textContent = 'Menu';
  menuBtn.addEventListener('click', () => { goToMenu(game); render(); });
  btnRow.appendChild(menuBtn);

  const nextLvl = game.currentLevelId ? LEVELS[LEVELS.findIndex(l => l.id === game.currentLevelId) + 1] : null;
  if (nextLvl) {
    const nextBtn = el('button', 'ctrl-btn primary');
    nextBtn.textContent = `Next: ${nextLvl.name} \u2192`;
    nextBtn.addEventListener('click', () => { clearInteraction(); nextLevel(game); render(); });
    btnRow.appendChild(nextBtn);
  }

  modal.appendChild(btnRow);
  app.appendChild(modal);
}

// ── Interaction ───────────────────────────────────────

function selectRule(rule) {
  if (selectedRule?.id === rule.id) {
    clearInteraction();
    render();
    return;
  }

  selectedRule = rule;
  collectedInputs = { lineIds: [], proposition: null };
  inputStep = 0;
  clearError();

  // If rule has no inputs, apply immediately
  if (!rule.inputs || rule.inputs.length === 0) {
    applyRule();
    return;
  }

  render();

  // Focus proposition input if that's the first step
  if (rule.inputs[0].type === 'proposition') {
    setTimeout(() => {
      const field = document.getElementById('prop-input-field');
      if (field) field.focus();
    }, 50);
  }
}

function selectLine(lineId) {
  if (!selectedRule) return;
  const step = selectedRule.inputs[inputStep];
  if (!step || step.type !== 'line') return;

  collectedInputs.lineIds.push(lineId);
  inputStep++;

  // Check if we have all inputs
  if (inputStep >= selectedRule.inputs.length) {
    applyRule();
  } else if (selectedRule.inputs[inputStep].type === 'proposition') {
    // Next input is a proposition, re-render to show input field
    render();
    setTimeout(() => {
      const field = document.getElementById('prop-input-field');
      if (field) field.focus();
    }, 50);
  } else {
    render();
  }
}

function submitProposition(text) {
  if (!selectedRule) return;
  const step = selectedRule.inputs[inputStep];
  if (!step || step.type !== 'proposition') return;

  try {
    const prop = parse(text.trim());
    collectedInputs.proposition = prop;
    inputStep++;

    if (inputStep >= selectedRule.inputs.length) {
      applyRule();
    } else {
      render();
    }
  } catch (e) {
    showError(`Invalid proposition: ${e.message}`);
  }
}

function applyRule() {
  const rule = selectedRule;
  if (!rule) return;

  const result = rule.apply(game.proof, collectedInputs);
  clearInteraction();

  if (result.success) {
    clearError();
    // Check if proof is complete
    if (game.proof.complete) {
      completeLevel(game);
    }
    render();
  } else {
    showError(result.error || 'Rule application failed');
    render();
  }
}

function clearInteraction() {
  selectedRule = null;
  collectedInputs = { lineIds: [], proposition: null };
  inputStep = 0;
  showHint = false;
}

function showError(msg) {
  errorMessage = msg;
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    errorMessage = null;
    const errEl = document.querySelector('.error-msg');
    if (errEl) errEl.remove();
  }, 4000);
}

function clearError() {
  errorMessage = null;
  if (errorTimeout) clearTimeout(errorTimeout);
}

// ── DOM Helpers ───────────────────────────────────────

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
