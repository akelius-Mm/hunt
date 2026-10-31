import type Phaser from 'phaser';

/**
 * One finger does everything on a touchscreen:
 * - tap: walk there (a second tap right after: run there)
 * - hold: aim (the hunt) or load a cast (the river), then let go
 * - swipe down: crouch or stand up
 * Timings use the touch's own timestamps, so a slow frame can't turn a tap into a hold.
 */
export type Gesture = 'tap' | 'double-tap' | 'swipe-down' | 'hold';

const TAP_MS = 250;
const DOUBLE_MS = 350;
const TAP_SLOP = 24;
const SWIPE_MS = 320;
const SWIPE_PX = 36;

export class Gestures {
  private lastTapAt = -Infinity;

  /** Call when the finger lifts. */
  classify(p: Phaser.Input.Pointer): Gesture {
    const ms = p.upTime - p.downTime;
    const dx = p.upX - p.downX;
    const dy = p.upY - p.downY;
    if (ms < SWIPE_MS && dy > SWIPE_PX && dy > Math.abs(dx) * 1.5) return 'swipe-down';
    if (ms < TAP_MS && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
      const double = p.upTime - this.lastTapAt < DOUBLE_MS;
      this.lastTapAt = double ? -Infinity : p.upTime;
      return double ? 'double-tap' : 'tap';
    }
    return 'hold';
  }

  /** True while a touch is still young enough to turn out to be a tap or a swipe. */
  static undecided(p: Phaser.Input.Pointer, now: number): boolean {
    return now - p.downTime < TAP_MS;
  }
}
