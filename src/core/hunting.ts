import { item } from '../data/items';
import { addItem, count, has } from './state';
import type { AnimalDef, GameState, Quality, TimeOfDay, WeaponKind, Zone } from './types';

/** World pixels per yard. The screen is 480 px wide, so about 240 yards across. */
export const PX_PER_YARD = 2;

export const SUNRISE = 6.5;
export const SUNSET = 18.5;
/** Legal shooting light: 30 minutes either side of sunrise and sunset. */
export const LEGAL_START = SUNRISE - 0.5;
export const LEGAL_END = SUNSET + 0.5;

export function timeOfDay(hour: number): TimeOfDay {
  if (hour < 9) return 'dawn';
  if (hour < 16) return 'day';
  return 'dusk';
}

export function isLegalLight(hour: number): boolean {
  return hour >= LEGAL_START && hour <= LEGAL_END;
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export interface ShotCheck {
  ok: boolean;
  lesson?: string;
}

/** Everything a responsible hunter checks before pulling the trigger. */
export function checkShot(
  state: GameState,
  animal: AnimalDef,
  weaponId: string | null,
  distanceYards: number,
  hour: number,
): ShotCheck {
  if (!has(state, 'hunting-license')) return { ok: false, lesson: 'no-license' };
  if (!isLegalLight(hour)) return { ok: false, lesson: 'shooting-hours' };
  const weapon = weaponId ? item(weaponId).weapon : undefined;
  if (!weapon || !animal.legalAmmo.includes(weapon.ammo)) return { ok: false, lesson: 'wrong-weapon' };
  if (animal.tag && !has(state, animal.tag)) return { ok: false, lesson: 'no-tag' };
  if (count(state, weapon.ammo) <= 0) return { ok: false, lesson: 'no-ammo' };
  if (distanceYards > weapon.rangeYards) return { ok: false, lesson: 'out-of-range' };
  return { ok: true };
}

/** Which zone a point hits, in sprite pixel coordinates (sprite facing right). */
export function zoneAt(animal: AnimalDef, px: number, py: number): Zone | null {
  const x = Math.floor(px);
  const y = Math.floor(py);
  for (const r of animal.zones) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.zone;
  }
  return null;
}

export interface ShotResult {
  result: 'clean' | 'wounded' | 'miss';
  quality?: Quality;
  lesson: string;
}

export function resolveShot(animal: AnimalDef, kind: WeaponKind, zone: Zone | null): ShotResult {
  if (!zone) return { result: 'miss', lesson: 'miss' };
  if (animal.cleanZones[kind]?.includes(zone)) {
    return { result: 'clean', quality: zone === 'legs' ? 'Good' : 'Prime', lesson: 'clean-harvest' };
  }
  if (animal.fairZones?.[kind]?.includes(zone)) {
    return { result: 'clean', quality: 'Fair', lesson: 'clean-harvest' };
  }
  if (animal.id === 'turkey' && kind === 'shotgun') return { result: 'wounded', lesson: 'turkey-head' };
  if (animal.tag === 'deer-tag' && zone === 'head') return { result: 'wounded', lesson: 'head-risk' };
  return { result: 'wounded', lesson: 'wounded' };
}

export type Movement = 'still' | 'sneak' | 'walk' | 'run';

export interface SenseContext {
  distanceYards: number;
  movement: Movement;
  inStand: boolean;
  /** +1 if the wind blows toward +x (right), -1 toward the left. */
  windDir: 1 | -1;
  /** +1 if the animal is to the right of the player, -1 if to the left. */
  animalSide: 1 | -1;
  scentSpray: boolean;
}

export type Sense = 'sight' | 'sound' | 'scent';

export interface Awareness {
  /** Awareness gained per second. The animal flees at 1. */
  perSecond: number;
  cause: Sense | null;
}

const MOVE_VISIBILITY: Record<Movement, number> = { still: 0.15, sneak: 0.5, walk: 1, run: 1.4 };
const MOVE_NOISE: Record<Movement, number> = { still: 0, sneak: 0.25, walk: 0.55, run: 1 };

/** How quickly an animal notices the hunter through each sense. The strongest sense wins. */
export function senses(animal: AnimalDef, ctx: SenseContext): Awareness {
  const d = ctx.distanceYards;
  const stand = ctx.inStand ? 0.4 : 1;
  const candidates: [Sense, number][] = [];

  const sightRange = animal.sightYards * stand;
  if (d < sightRange) candidates.push(['sight', (1 - d / sightRange) * 1.2 * MOVE_VISIBILITY[ctx.movement]]);

  const hearRange = animal.hearingYards * MOVE_NOISE[ctx.movement];
  if (d < hearRange) candidates.push(['sound', (1 - d / hearRange) * 2]);

  // Scent drifts downwind: the animal smells you if the wind blows from you toward it.
  const downwind = ctx.windDir === ctx.animalSide;
  const scentRange = animal.scentYards * (ctx.scentSpray ? 0.45 : 1) * (ctx.inStand ? 0.5 : 1);
  if (downwind && d < scentRange) candidates.push(['scent', 0.6 + (1 - d / scentRange) * 2.5]);

  let best: Awareness = { perSecond: 0, cause: null };
  for (const [cause, rate] of candidates) {
    if (rate > best.perSecond) best = { perSecond: rate, cause };
  }
  return best;
}

export interface HarvestResult {
  items: Record<string, number>;
  meatLbs: number;
  lessons: string[];
}

/** Tag, field dress and record a harvest. Assumes checkShot passed before the shot. */
export function harvest(
  state: GameState,
  animal: AnimalDef,
  quality: Quality,
  weaponId: string,
  rand: () => number = Math.random,
): HarvestResult {
  const lessons: string[] = [];
  if (animal.tag) addItem(state, animal.tag, -1);

  const items: Record<string, number> = {};
  const hasKnife = has(state, 'knife');
  if (hasKnife) {
    for (const drop of animal.loot) {
      if (rand() < drop.chance) items[drop.item] = (items[drop.item] ?? 0) + drop.qty;
    }
    for (const [id, qty] of Object.entries(items)) addItem(state, id, qty);
  } else {
    lessons.push('no-knife');
  }

  const meatShare = quality === 'Prime' ? 1 : quality === 'Good' ? 0.85 : 0.6;
  const meatLbs = Math.max(1, Math.round(animal.meatLbs * meatShare * (hasKnife ? 1 : 0.7)));
  state.freezer[animal.meatName] = (state.freezer[animal.meatName] ?? 0) + meatLbs;
  lessons.push('meat');

  state.harvests.push({ day: state.day, animal: animal.id, quality, weapon: weaponId });
  return { items, meatLbs, lessons };
}
