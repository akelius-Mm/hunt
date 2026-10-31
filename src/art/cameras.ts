import Phaser from 'phaser';
import type { Backdrop } from './backdrop';
import { PX, SCREEN_H, SCREEN_W, VIEW_W } from './view';

/**
 * Three cameras draw each scene:
 * - back: the backdrop behind the characters, in screen pixels.
 * - world: characters, animals and effects, in world units, magnified PX times so
 *   their high-resolution sprites land one texture pixel per screen pixel.
 * - front: foreground ferns and falling leaves, over the characters.
 * Phones zoom all three a little more, around a point low on the screen.
 */
export interface SceneCameras {
  back: Phaser.Cameras.Scene2D.Camera;
  world: Phaser.Cameras.Scene2D.Camera;
  front: Phaser.Cameras.Scene2D.Camera;
  /** Point the world camera at a world x (smoothly), clamped to the world. Returns the view's left edge in world units. */
  follow(x: number, worldWidth: number, lerp?: number): number;
  fadeOut(ms: number, done: () => void): void;
  shake(ms: number, intensity: number): void;
}

export function setupCameras(scene: Phaser.Scene, backdrop: Backdrop, opts: { touchZoom?: number } = {}): SceneCameras {
  const zoom = opts.touchZoom ?? 1;
  const originY = opts.touchZoom ? 0.75 : 0.5;
  const back = scene.cameras.main;
  back.setZoom(zoom).setOrigin(0.5, originY);
  const world = scene.cameras.add(0, 0, SCREEN_W, SCREEN_H).setZoom(PX * zoom).setOrigin(0.5, originY);
  const front = scene.cameras.add(0, 0, SCREEN_W, SCREEN_H).setZoom(zoom).setOrigin(0.5, originY);

  // Line the world up with the screen: world y 0..270 maps onto screen 0..540.
  const ox = SCREEN_W * 0.5;
  const oy = SCREEN_H * originY;
  world.scrollY = (-oy * (PX - 1)) / PX;

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
  return {
    back,
    world,
    front,
    follow(x, worldWidth, lerp = 0.1) {
      const target = Phaser.Math.Clamp(x - VIEW_W / 2, 0, Math.max(0, worldWidth - VIEW_W));
      left += (target - left) * lerp;
      if (Math.abs(target - left) < 0.01) left = target;
      world.scrollX = left - (ox * (PX - 1)) / PX;
      return left;
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
