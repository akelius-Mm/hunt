import Phaser from 'phaser';
import type { Backdrop } from './backdrop';
import { PX, SCREEN_H, SCREEN_W, VIEW_W } from './view';

/**
 * Three cameras draw each scene:
 * - back: the backdrop behind the characters, in screen pixels.
 * - world: characters, animals and effects, in world units, magnified PX times so
 *   sprites land one texture pixel per screen pixel.
 * - front: foreground ferns and falling leaves, over the characters.
 * They always share one zoom and zoom origin, so the world stays lined up with the
 * scenery. Zooming in (for aiming) eases toward a target zoom around a screen point.
 */
export interface SceneCameras {
  back: Phaser.Cameras.Scene2D.Camera;
  world: Phaser.Cameras.Scene2D.Camera;
  front: Phaser.Cameras.Scene2D.Camera;
  /** Point the view at a world x (smoothly), clamped to the world. Call every frame. Returns the view's left edge in world units. */
  follow(x: number, worldWidth: number, lerp?: number): number;
  /** Ease toward a zoom around a point on screen (0..1 fractions). Zoom 1 is the normal wide view. */
  zoomTo(zoom: number, atX?: number, atY?: number): void;
  fadeOut(ms: number, done: () => void): void;
  shake(ms: number, intensity: number): void;
}

const DEFAULT_ORIGIN_Y = 0.5;

export function setupCameras(scene: Phaser.Scene, backdrop: Backdrop): SceneCameras {
  const back = scene.cameras.main;
  const world = scene.cameras.add(0, 0, SCREEN_W, SCREEN_H);
  const front = scene.cameras.add(0, 0, SCREEN_W, SCREEN_H);

  world.ignore([...backdrop.back, ...backdrop.front]);
  back.ignore(backdrop.front);
  front.ignore(backdrop.back);
  // Everything added from now on belongs to the world.
  const claim = (go: Phaser.GameObjects.GameObject) => {
    back.ignore(go);
    front.ignore(go);
  };
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, claim);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, claim));

  let left = 0;
  let zoom = 1;
  let target = 1;
  let ox = 0.5;
  let oy = DEFAULT_ORIGIN_Y;

  /** Apply zoom and origin to all three, and line the world up with the screen. */
  const apply = () => {
    for (const c of [back, front]) c.setZoom(zoom).setOrigin(ox, oy);
    world.setZoom(PX * zoom).setOrigin(ox, oy);
    // With matching origins, world x maps to screen x * PX for any zoom.
    world.scrollX = left - (SCREEN_W * ox * (PX - 1)) / PX;
    world.scrollY = -(SCREEN_H * oy * (PX - 1)) / PX;
  };
  apply();

  return {
    back,
    world,
    front,
    follow(x, worldWidth, lerp = 0.1) {
      const goal = Phaser.Math.Clamp(x - VIEW_W / 2, 0, Math.max(0, worldWidth - VIEW_W));
      // Hold still while zoomed in, so the aim doesn't drift.
      if (target === 1) left += (goal - left) * lerp;
      if (Math.abs(goal - left) < 0.01) left = goal;
      zoom += (target - zoom) * 0.25;
      if (Math.abs(target - zoom) < 0.005) zoom = target;
      if (zoom === 1) {
        ox = 0.5;
        oy = DEFAULT_ORIGIN_Y;
      }
      apply();
      return left;
    },
    zoomTo(z, atX, atY) {
      target = z;
      if (z > 1 && atX !== undefined && atY !== undefined) {
        // Zoom around the point the player is aiming at, so it stays under their finger.
        ox = Phaser.Math.Clamp(atX, 0, 1);
        oy = Phaser.Math.Clamp(atY, 0, 1);
      }
    },
    fadeOut(ms, done) {
      back.fadeOut(ms, 0, 0, 0);
      world.fadeOut(ms, 0, 0, 0);
      front.fadeOut(ms, 0, 0, 0);
      back.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done);
    },
    shake(ms, intensity) {
      back.shake(ms, intensity);
      world.shake(ms, intensity);
      front.shake(ms, intensity);
    },
  };
}
