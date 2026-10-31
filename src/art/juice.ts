import Phaser from 'phaser';

/**
 * Small moments of feedback: particle bursts (splashes, dust, feathers) and words that
 * float up and fade ("Clean shot!", "+42 lb venison"). All in world units.
 */

export interface BurstOptions {
  colors: number[];
  count: number;
  /** How fast particles fly out, in world units per second. */
  speed: number;
  /** Upward bias: 1 throws everything up (a splash), 0 sprays all around (dust). */
  up?: number;
  gravity?: number;
  life?: number;
  size?: number;
  depth?: number;
}

export function burst(scene: Phaser.Scene, x: number, y: number, o: BurstOptions): void {
  const life = o.life ?? 600;
  const gravity = o.gravity ?? 160;
  const size = o.size ?? 1;
  for (let i = 0; i < o.count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (2 - (o.up ?? 0.5) * 1.6);
    const v = o.speed * (0.4 + Math.random() * 0.6);
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v;
    const p = scene.add.rectangle(x, y, size, size, o.colors[i % o.colors.length]).setDepth(o.depth ?? 30);
    const start = scene.time.now;
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: life * (0.6 + Math.random() * 0.4),
      onUpdate: () => {
        const t = (scene.time.now - start) / 1000;
        p.setPosition(x + vx * t, y + vy * t + 0.5 * gravity * t * t);
      },
      onComplete: () => p.destroy(),
    });
    scene.tweens.add({ targets: p, alpha: 0, delay: life * 0.4, duration: life * 0.5 });
  }
}

export const SPLASH = [0xffffff, 0xd8eef4, 0xa8cfe0];
export const DUST = [0xc8a870, 0xa8865a, 0xe0c890];

/** Words that pop up over something, rise and fade. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#fff2d8', big = false): void {
  const t = scene.add
    .text(x, y, text, { fontFamily: '"Pixelify Sans", monospace', fontSize: big ? '9px' : '7px', color, stroke: '#1a120c', strokeThickness: 2 })
    .setOrigin(0.5, 1)
    .setResolution(4)
    .setDepth(70)
    .setScale(0.4);
  scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, y: y - 18, duration: 1400, ease: 'Sine.Out' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 500, onComplete: () => t.destroy() });
}
