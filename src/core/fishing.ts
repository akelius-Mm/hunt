import { FLIES, TROUT_LIMIT } from '../data/fish';
import { has } from './state';
import type { FishDef, FlyType, GameState } from './types';

export type Hatch = 'mayfly' | 'caddis' | null;

/** Which insects are hatching. Mayflies late morning, caddis in the evening. */
export function hatchAt(hour: number): Hatch {
  if (hour >= 9.5 && hour < 13) return 'mayfly';
  if (hour >= 16.5 && hour < 19.2) return 'caddis';
  return null;
}

export function lowLight(hour: number): boolean {
  return hour < 8.5 || hour > 17.5;
}

/**
 * How likely a trout near the fly is to take it, per second. Dry flies only work
 * when they match a hatch; nymphs work all day; streamers want low light.
 */
export function strikeRate(fish: FishDef, fly: FlyType, hour: number, castQuality: number): number {
  const hatch = hatchAt(hour);
  let appeal: number;
  if (fly === 'nymph') appeal = 0.45;
  else if (fly === 'streamer') appeal = lowLight(hour) ? 0.55 : 0.15;
  else appeal = hatch === fly ? 1 : hatch ? 0.05 : 0.1;
  // A sloppy cast drags the fly unnaturally.
  return 0.6 * appeal * fish.likes[fly] * (0.4 + 0.6 * castQuality);
}

/** Why you can't cast yet, as a lesson id, or null when you're set. */
export function cannotFish(state: GameState, flyId: string | null): string | null {
  if (!has(state, 'fishing-license')) return 'fishing-license';
  if (!has(state, 'trout-stamp')) return 'trout-stamp';
  if (!has(state, 'fly-rod')) return 'no-rod';
  if (!flyId || !has(state, flyId)) return 'no-flies';
  return null;
}

export function flyType(flyId: string): FlyType {
  const t = FLIES[flyId];
  if (!t) throw new Error(`Not a fly: ${flyId}`);
  return t;
}

/** Cast quality from how far off the rhythm the release was (0 = perfect, 0.5 = worst). */
export function castQuality(timingError: number): number {
  return Math.max(0, 1 - Math.abs(timingError) * 2.6);
}

/** Whether a caught trout may be kept, as a lesson id when it can't. */
export function cannotKeep(fish: FishDef, lengthIn: number, keptToday: number): string | null {
  if (lengthIn < fish.keepMinIn) return 'keep-size';
  if (keptToday >= TROUT_LIMIT) return 'fish-limit';
  return null;
}

/** Roughly how heavy a trout is, in pounds, from its length in inches. */
export function troutLbs(lengthIn: number): number {
  return Math.round(((lengthIn * lengthIn * lengthIn) / 1600) * 10) / 10;
}

export interface FightState {
  /** 0..100. Above 100 the tippet snaps. */
  tension: number;
  /** 0..100. At 100 the fish is at the net. */
  progress: number;
  /** Seconds spent with too little tension. */
  slack: number;
  /** The fish's current pull, 0..1. */
  surge: number;
}

export const TENSION_LOW = 22;
export const TENSION_HIGH = 82;

/**
 * One step of the fight. Reeling raises tension and brings the fish in; letting go
 * lets it run. The fish surges at random, so you have to watch the meter.
 */
export function stepFight(f: FightState, reeling: boolean, strength: number, dt: number, rand: () => number = Math.random): 'on' | 'snapped' | 'thrown' | 'landed' {
  if (rand() < dt * 0.6) f.surge = 0.4 + rand() * 0.6;
  f.surge = Math.max(0, f.surge - dt * 0.35);
  const pull = f.surge * strength;
  if (reeling) {
    f.tension += (30 + pull * 70) * dt;
    f.progress += (16 - pull * 12) * dt;
  } else {
    f.tension -= (38 - pull * 30) * dt;
    f.progress -= pull * 10 * dt;
  }
  f.tension = Math.max(0, f.tension);
  f.progress = Math.max(0, Math.min(100, f.progress));
  f.slack = f.tension < TENSION_LOW ? f.slack + dt : 0;
  if (f.tension > 100) return 'snapped';
  if (f.slack > 2.2) return 'thrown';
  if (f.progress >= 100) return 'landed';
  return 'on';
}
