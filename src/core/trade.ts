import { item } from '../data/items';
import { addItem, count } from './state';
import type { GameState } from './types';

/**
 * Hollis is a trapper who barters instead of paying cash. He values things by the
 * outfitter's base prices, adjusted by what he likes.
 */
export const TRADER_NAME = 'Old Hollis';

/** How Hollis values items you give him, relative to their base price. */
export const TRADER_WANTS: Record<string, number> = {
  'deer-hide': 1.5,
  'rabbit-pelt': 1.5,
  'squirrel-tail': 1.2,
  'shed-antler': 1.3,
  antlers: 1.2,
  'turkey-feathers': 0.8,
};

/** Used gear Hollis may have, with the base value he puts on it. */
export const TRADER_GOODS: Record<string, number> = {
  'ammo-22': 10,
  'ammo-turkey': 20,
  'ammo-308': 40,
  'arrows-broadhead': 35,
  'scent-spray': 14,
  binoculars: 110,
  'grunt-call': 22,
  'box-call': 28,
  'orange-vest': 15,
  knife: 25,
};

/** He wants more than he gives. The margin shrinks as he gets to like you. */
export function traderMargin(state: GameState): number {
  return Math.max(1.0, 1.3 - state.traderRep * 0.03);
}

export type Basket = Record<string, number>;

export function valueOfGiven(basket: Basket): number {
  let total = 0;
  for (const [id, qty] of Object.entries(basket)) {
    const base = item(id).sellPrice ?? 0;
    total += base * (TRADER_WANTS[id] ?? 0) * qty;
  }
  return Math.round(total);
}

export function valueOfTaken(basket: Basket): number {
  let total = 0;
  for (const [id, qty] of Object.entries(basket)) total += (TRADER_GOODS[id] ?? 0) * qty;
  return Math.round(total);
}

export interface TradeVerdict {
  accept: boolean;
  give: number;
  take: number;
  /** What the offer needs to be worth for him to accept. */
  needed: number;
  message: string;
}

export function evaluateTrade(state: GameState, give: Basket, take: Basket): TradeVerdict {
  const giveV = valueOfGiven(give);
  const takeV = valueOfTaken(take);
  const needed = Math.ceil(takeV * traderMargin(state));
  const base = { give: giveV, take: takeV, needed };

  for (const [id, qty] of Object.entries(give)) {
    if (qty > count(state, id)) return { ...base, accept: false, message: "You don't have that many." };
    if (!TRADER_WANTS[id]) return { ...base, accept: false, message: `"I've no use for ${item(id).name}."` };
  }
  for (const [id, qty] of Object.entries(take)) {
    if (qty > (state.traderStock[id] ?? 0)) return { ...base, accept: false, message: '"I don\'t have that many."' };
    if (item(id).unique && (qty > 1 || count(state, id) > 0)) {
      return { ...base, accept: false, message: `"You've already got a ${item(id).name}."` };
    }
  }
  if (takeV === 0) return { ...base, accept: false, message: '"What do you want from me, then?"' };
  if (giveV < needed) return { ...base, accept: false, message: `"Not enough. Bring me something worth about ${needed}."` };
  return { ...base, accept: true, message: '"Deal. Pleasure doing business."' };
}

export function executeTrade(state: GameState, give: Basket, take: Basket): TradeVerdict {
  const verdict = evaluateTrade(state, give, take);
  if (!verdict.accept) return verdict;
  for (const [id, qty] of Object.entries(give)) addItem(state, id, -qty);
  for (const [id, qty] of Object.entries(take)) {
    // Ammo and spray come in packs, the same as at the outfitter.
    addItem(state, id, qty * (item(id).packSize ?? 1));
    state.traderStock[id] -= qty;
    if (state.traderStock[id] === 0) delete state.traderStock[id];
  }
  state.traderRep += 1;
  return verdict;
}

/** Deterministic random numbers, so a given day always has the same stock. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollTraderStock(day: number): Record<string, number> {
  const rand = mulberry32(day * 7919);
  const ids = Object.keys(TRADER_GOODS);
  const stock: Record<string, number> = {};
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const id = ids[Math.floor(rand() * ids.length)];
    stock[id] = (stock[id] ?? 0) + 1;
  }
  return stock;
}
