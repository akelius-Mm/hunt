import { HUNTER_ED, item } from '../data/items';
import { addItem, count, has } from './state';
import { rollTraderStock } from './trade';
import type { GameState } from './types';

/** Each unit sold lowers the outfitter's price for that item by this factor. */
export const DEMAND_DROP = 0.9;
export const MIN_DEMAND = 0.4;
/** Share of the gap back to full demand that recovers each day. */
export const DEMAND_RECOVERY = 0.35;
/** Reputation points per 1% discount, capped at MAX_DISCOUNT. */
export const REP_PER_PERCENT = 10;
export const MAX_DISCOUNT = 0.15;

export function discount(state: GameState): number {
  return Math.min(MAX_DISCOUNT, state.reputation / REP_PER_PERCENT / 100);
}

export function buyPrice(state: GameState, itemId: string): number {
  const def = item(itemId);
  if (def.price === undefined) throw new Error(`${itemId} is not for sale`);
  return Math.round(def.price * (1 - discount(state)));
}

export function demandOf(state: GameState, itemId: string): number {
  return state.demand[itemId] ?? 1;
}

export function sellPrice(state: GameState, itemId: string): number {
  const def = item(itemId);
  if (def.sellPrice === undefined) throw new Error(`${itemId} can't be sold`);
  return Math.max(1, Math.round(def.sellPrice * demandOf(state, itemId)));
}

export interface Check {
  ok: boolean;
  reason?: string;
}

export function canBuy(state: GameState, itemId: string): Check {
  const def = item(itemId);
  if (def.price === undefined) return { ok: false, reason: 'Not sold here.' };
  if (def.unique && has(state, itemId)) return { ok: false, reason: 'You already own this.' };
  for (const req of def.requires ?? []) {
    if (req === HUNTER_ED) {
      if (!state.hunterEd) return { ok: false, reason: 'Pass hunter education first (at camp).' };
    } else if (!has(state, req)) {
      return { ok: false, reason: `Requires: ${item(req).name}.` };
    }
  }
  if (state.money < buyPrice(state, itemId)) return { ok: false, reason: 'Not enough money.' };
  return { ok: true };
}

export function buy(state: GameState, itemId: string): Check {
  const check = canBuy(state, itemId);
  if (!check.ok) return check;
  const def = item(itemId);
  state.money -= buyPrice(state, itemId);
  addItem(state, itemId, def.packSize ?? 1);
  if (def.weapon && !state.equippedWeapon) state.equippedWeapon = itemId;
  return { ok: true };
}

/** Sells up to qty units, one at a time so each sale lowers the next price. Returns money earned. */
export function sell(state: GameState, itemId: string, qty: number): number {
  const n = Math.min(qty, count(state, itemId));
  let earned = 0;
  for (let i = 0; i < n; i++) {
    earned += sellPrice(state, itemId);
    addItem(state, itemId, -1);
    state.demand[itemId] = Math.max(MIN_DEMAND, demandOf(state, itemId) * DEMAND_DROP);
  }
  state.money += earned;
  return earned;
}

/** Advance to the next day: prices recover, the trader restocks. */
export function nextDay(state: GameState): void {
  state.day += 1;
  for (const [id, d] of Object.entries(state.demand)) {
    const next = d + (1 - d) * DEMAND_RECOVERY;
    if (next > 0.99) delete state.demand[id];
    else state.demand[id] = next;
  }
  state.traderStock = rollTraderStock(state.day);
}

/** Donating meat earns community reputation: 1 point per 5 lbs, rounded up. */
export function donateMeat(state: GameState): { lbs: number; rep: number } {
  const lbs = Object.values(state.freezer).reduce((a, b) => a + b, 0);
  const rep = Math.ceil(lbs / 5);
  state.freezer = {};
  state.reputation += rep;
  return { lbs, rep };
}
