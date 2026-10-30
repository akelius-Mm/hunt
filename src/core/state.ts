import type { GameState } from './types';
import { rollTraderStock } from './trade';

const SAVE_KEY = 'hunt-save-v1';

export function newGame(): GameState {
  const state: GameState = {
    version: 1,
    day: 1,
    money: 250,
    inventory: {},
    equippedWeapon: null,
    hunterEd: false,
    reputation: 0,
    traderRep: 0,
    demand: {},
    freezer: {},
    seenAnimals: [],
    lessons: [],
    harvests: [],
    traderStock: {},
  };
  state.traderStock = rollTraderStock(state.day);
  return state;
}

export function count(state: GameState, itemId: string): number {
  return state.inventory[itemId] ?? 0;
}

export function has(state: GameState, itemId: string): boolean {
  return count(state, itemId) > 0;
}

export function addItem(state: GameState, itemId: string, qty: number): void {
  const next = count(state, itemId) + qty;
  if (next < 0) throw new Error(`Not enough ${itemId}`);
  if (next === 0) delete state.inventory[itemId];
  else state.inventory[itemId] = next;
}

/** Records a lesson. Returns true the first time it is learned. */
export function learn(state: GameState, lessonId: string): boolean {
  if (state.lessons.includes(lessonId)) return false;
  state.lessons.push(lessonId);
  return true;
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode). The game still works, just without saves.
  }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
