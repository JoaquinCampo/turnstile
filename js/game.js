// game.js — Game state, level progression, persistence

import { createProof, undo as proofUndo, resetProof } from './proof.js';
import { LEVELS, WORLDS, getLevel, getNextLevel, getLevelIndex } from './levels.js';

const STORAGE_KEY = 'turnstile_progress';

export function createGame() {
  const progress = loadProgress();

  const game = {
    currentLevelId: null,
    proof: null,
    levelDef: null,
    progress, // { completedLevels: Set<string>, bestSteps: { [levelId]: number } }
    screen: 'menu', // 'menu' | 'level' | 'victory'
  };

  return game;
}

// Load/save progress
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        completedLevels: new Set(data.completedLevels || []),
        bestSteps: data.bestSteps || {},
      };
    }
  } catch (e) { /* ignore */ }
  return { completedLevels: new Set(), bestSteps: {} };
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completedLevels: [...progress.completedLevels],
      bestSteps: progress.bestSteps,
    }));
  } catch (e) { /* ignore */ }
}

// Start a level
export function startLevel(game, levelId) {
  const levelDef = getLevel(levelId);
  if (!levelDef) throw new Error(`Unknown level: ${levelId}`);

  game.currentLevelId = levelId;
  game.levelDef = levelDef;
  game.proof = createProof(levelDef.assumptions, levelDef.goal);
  game.screen = 'level';
}

// Undo last move
export function undoMove(game) {
  if (!game.proof) return false;
  return proofUndo(game.proof);
}

// Reset current level
export function resetLevel(game) {
  if (!game.proof || !game.levelDef) return;
  game.proof = createProof(game.levelDef.assumptions, game.levelDef.goal);
}

// Mark level complete
export function completeLevel(game) {
  if (!game.currentLevelId || !game.proof) return;

  const levelId = game.currentLevelId;
  const steps = game.proof.lines.length;

  game.progress.completedLevels.add(levelId);

  if (!game.progress.bestSteps[levelId] || steps < game.progress.bestSteps[levelId]) {
    game.progress.bestSteps[levelId] = steps;
  }

  saveProgress(game.progress);
  game.screen = 'victory';
}

// Go to next level
export function nextLevel(game) {
  const next = getNextLevel(game.currentLevelId);
  if (next) {
    startLevel(game, next.id);
  } else {
    game.screen = 'menu';
  }
}

// Go to menu
export function goToMenu(game) {
  game.screen = 'menu';
  game.currentLevelId = null;
  game.proof = null;
  game.levelDef = null;
}

// Check if a level is unlocked
export function isLevelUnlocked(game, levelId) {
  const idx = getLevelIndex(levelId);
  if (idx === 0) return true;
  // A level is unlocked if the previous level is completed
  const prev = LEVELS[idx - 1];
  return game.progress.completedLevels.has(prev.id);
}

// Get overall progress
export function getProgress(game) {
  return {
    completed: game.progress.completedLevels.size,
    total: LEVELS.length,
    worlds: WORLDS.map(world => {
      const worldLevels = LEVELS.filter(l => l.world === world.id);
      const completed = worldLevels.filter(l => game.progress.completedLevels.has(l.id)).length;
      return { ...world, total: worldLevels.length, completed };
    }),
  };
}
