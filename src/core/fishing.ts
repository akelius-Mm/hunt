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

/** Cast quality from how far off the rhythm the release was (0 = perfect, 0.5 = worst). Forgiving near the sweet spot. */
export function castQuality(timingError: number): number {
  return Math.max(0, 1 - Math.max(0, Math.abs(timingError) - 0.08) * 2.4);
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
  /** 0..100. The reel's drag holds it at DRAG. */
  tension: number;
  /** 0..100. At 100 the fish is at the net. */
  progress: number;
  /** Seconds spent with too little tension. */
  slack: number;
  /** The fish's current pull, 0..1. */
  surge: number;
  /** Seconds spent cranking against a hard run. Too long and the tippet snaps. */
  strain: number;
}

export const TENSION_LOW = 18;
export const TENSION_HIGH = 85;
/** The reel's drag: tension never goes above this. A hard pull takes line instead. */
export const DRAG = 92;
/** A pull this strong is a run: the fish is taking line. */
export const RUN = 0.55;
const SNAP_SECONDS = 2.5;
const SLACK_SECONDS = 3.5;

export function newFight(): FightState {
  return { tension: 45, progress: 0, slack: 0, surge: 0.5, strain: 0 };
}

/** True while the fish is making a run: the time to stop reeling. */
export function running(f: FightState, strength: number): boolean {
  return f.surge * strength > RUN;
}

/**
 * One step of the fight. Holding to reel brings the fish in. When it pulls hard,
 * the drag slips and it takes some line back, so the line only snaps if you keep
 * cranking through a run for a few seconds. Letting go too long gives slack.
 */
export function stepFight(f: FightState, reeling: boolean, strength: number, dt: number, rand: () => number = Math.random): 'on' | 'snapped' | 'thrown' | 'landed' {
  if (rand() < dt * 0.5) f.surge = 0.3 + rand() * 0.7;
  f.surge = Math.max(0, f.surge - dt * 0.4);
  const pull = f.surge * strength;
  if (reeling) {
    f.tension += (28 + pull * 50) * dt;
    f.progress += (14 - pull * 10) * dt;
  } else {
    f.tension -= (30 - pull * 22) * dt;
    f.progress -= pull * 6 * dt;
  }
  if (f.tension > DRAG) {
    // Drag slips: the fish takes line instead of breaking it.
    f.tension = DRAG;
    f.progress -= pull * 8 * dt;
  }
  f.tension = Math.max(0, f.tension);
  f.progress = Math.max(0, Math.min(100, f.progress));
  f.strain = reeling && pull > RUN && f.tension >= DRAG ? f.strain + dt : Math.max(0, f.strain - dt);
  f.slack = f.tension < TENSION_LOW ? f.slack + dt : 0;
  if (f.strain > SNAP_SECONDS) return 'snapped';
  if (f.slack > SLACK_SECONDS) return 'thrown';
  if (f.progress >= 100) return 'landed';
  return 'on';
}
