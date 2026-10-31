import Phaser from 'phaser';
import { Backdrop } from '../art/backdrop';
import { setupCameras, type SceneCameras } from '../art/cameras';
import { createSprites, frameKey, HAND, spriteImage } from '../art/sprites';
import { GROUND_Y, SCREEN_H, SCREEN_W, VIEW_W, WATER_Y } from '../art/view';
import {
  anyLoadedAmmo,
  checkShot,
  formatHour,
  harvest,
  isLegalLight,
  type Movement,
  PX_PER_YARD,
  resolveShot,
  senses,
  type Sense,
  timeOfDay,
  zoneAt,
} from '../core/hunting';
import { addItem, count, has } from '../core/state';
import type { AnimalDef, GameState, Quality } from '../core/types';
import { animal as animalDef, area as areaDef, type AreaDef } from '../data/animals';
import { item } from '../data/items';
import { lesson } from '../data/lessons';
import { note, teach } from '../ui/cards';
import { clearHud, setHud, setLabels, type Label } from '../ui/hud';
import { Gestures } from '../ui/gestures';
import { hideTouch, isTouch, pad, setTouchState, showTouch } from '../ui/touch';

const WORLD_W = 3200;
const START_HOUR = 5.5;
const END_HOUR = 19.5;
/** A full day takes this many real seconds. */
const DAY_SECONDS = 300;
const HOURS_PER_SEC = (END_HOUR - START_HOUR) / DAY_SECONDS;
const MAX_ANIMALS = 8;
const BREATH_SECONDS = 3;
const FINE_NO_ORANGE = 40;
/** Without binoculars, animals farther than this are hard to make out. */
const CLEAR_SIGHT_YARDS = 110;
const STAND_HEIGHT = 60;
/** How close you must be to tag an animal or pick something up, in pixels. */
const REACH = 24;

const SPEED: Record<Movement, number> = { still: 0, sneak: 22, walk: 46, run: 100 };
const SMALL_GAME = ['rabbit', 'squirrel'];
/** Aiming zooms in toward the target, like looking through a scope. */
const AIM_ZOOM = 2.2;
/** On a touchscreen the reticle sits this far above the finger (world pixels), so the finger doesn't hide the target. */
const TOUCH_AIM_LIFT = 14;
/** A shorter touch is treated as a tap, not an aimed shot. */
/** Seconds before a downed duck drifts out of reach. */
const DRIFT_SECONDS = 30;
const GRAVITY = 320;
const AMMO_SHORT: Record<string, string> = {
  'ammo-22': '.22', 'ammo-turkey': 'turkey loads', 'ammo-steel': 'steel', 'ammo-308': '.308', 'arrows-broadhead': 'arrows',
};

export interface HuntSummary {
  areaName: string;
  harvested: string[];
  items: Record<string, number>;
  meatLbs: number;
  fines: number;
  newLessons: number;
}

export interface HuntData {
  state: GameState;
  areaId: string;
  onEnd(summary: HuntSummary): void;
}

/** Ground animals idle, walk, flee. Ducks fly, land, swim and fall. */
type Mode = 'idle' | 'walk' | 'alert' | 'curious' | 'flee' | 'down' | 'fly' | 'land' | 'swim' | 'fall';

interface Animal {
  def: AnimalDef;
  sprite: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  mode: Mode;
  dir: 1 | -1;
  /** Ground x position; the sprite may hop above it. */
  x: number;
  awareness: number;
  timer: number;
  anim: number;
  quality?: Quality;
  weaponId?: string;
  /** Ducks: height (bottom of sprite) and where the flock means to land. */
  y: number;
  landX?: number;
  /** Ducks on the water: seconds until a downed bird drifts away. */
  drift: number;
  /** The dog has this bird in its mouth. */
  carried?: boolean;
}

interface Perched {
  bird: Phaser.GameObjects.Image;
  x: number;
  y: number;
  flying: boolean;
  t: number;
  dir: 1 | -1;
}

interface Dog {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  task: Animal | null;
  phase: 'follow' | 'out' | 'back';
  anim: number;
}

export class HuntScene extends Phaser.Scene {
  private state!: GameState;
  private area!: AreaDef;
  private onEnd!: (s: HuntSummary) => void;

  private backdrop!: Backdrop;
  private player!: Phaser.GameObjects.Image;
  private standGfx!: Phaser.GameObjects.Graphics;
  private scentGfx!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Graphics;
  private weaponGfx!: Phaser.GameObjects.Graphics;
  private cams!: SceneCameras;
  /** Left edge of the view, in world units. */
  private viewLeft = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private animals: Animal[] = [];
  private sheds: Phaser.GameObjects.Image[] = [];
  private hour = START_HOUR;
  private windDir: 1 | -1 = 1;
  private windTimer = 0;
  private spawnTimer = 0;
  private lastCall = -999;
  private crouched = false;
  private inStand = false;
  private aiming = false;
  private glassing = false;
  private breath = BREATH_SECONDS;
  private scentSpray = false;
  private facing: 1 | -1 = 1;
  private movement: Movement = 'still';
  private walkAnim = 0;
  private taughtThisHunt = new Set<string>();
  private ended = false;
  private summary!: HuntSummary;
  private lessonsAtStart = 0;
  private dog: Dog | null = null;
  /** Small birds resting on stumps; they flush when the hunter walks up. */
  private perched: Perched[] = [];
  /** Touch aiming: a finger is held on the scene. */
  private touchAim = false;
  private gestures = new Gestures();
  /** Where a tap asked the hunter to walk, and whether to run there. */
  private walkTo: { x: number; run: boolean } | null = null;
  private decoys: Phaser.GameObjects.Image[] = [];
  private decoyX = 0;
  /** Ducks downed today count toward the bag limit, retrieved or not. */
  private ducksDowned = 0;

  constructor() {
    super('hunt');
  }

  init(data: HuntData): void {
    this.state = data.state;
    this.area = areaDef(data.areaId);
    this.onEnd = data.onEnd;
    this.animals = [];
    this.sheds = [];
    this.hour = START_HOUR;
    this.windDir = Math.random() < 0.5 ? 1 : -1;
    this.windTimer = 60 + Math.random() * 60;
    this.spawnTimer = 0;
    this.lastCall = -999;
    this.crouched = false;
    this.inStand = false;
    this.aiming = false;
    this.glassing = false;
    this.breath = BREATH_SECONDS;
    this.scentSpray = false;
    this.facing = 1;
    this.movement = 'still';
    this.walkAnim = 0;
    this.taughtThisHunt = new Set();
    this.ended = false;
    this.lessonsAtStart = this.state.lessons.length;
    this.dog = null;
    this.touchAim = false;
    this.decoys = [];
    this.ducksDowned = 0;
    this.summary = { areaName: this.area.name, harvested: [], items: {}, meatLbs: 0, fines: 0, newLessons: 0 };
  }

  create(): void {
    createSprites(this);
    this.backdrop = new Backdrop(this, { scrolling: true, lake: this.area.lake });
    this.cams = setupCameras(this, this.backdrop);
    this.viewLeft = 0;
    this.scentGfx = this.add.graphics().setDepth(5);
    this.standGfx = this.add.graphics().setDepth(18);
    this.reticle = this.add.graphics().setDepth(60);
    this.weaponGfx = this.add.graphics().setDepth(21);

    this.player = spriteImage(this, 150, GROUND_Y, this.playerKey('idle')).setOrigin(0.5, 1).setDepth(20);

    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearHud();
      hideTouch();
    });
    if (isTouch()) {
      const weapons = ['rifle-22', 'shotgun-20', 'rifle-308', 'bow'].filter((id) => has(this.state, id));
      showTouch({
        act: () => this.interact(),
        glass: () => this.toggleGlassing(),
        call: () => this.useCall(),
        stand: () => this.toggleStand(),
        swap: () => this.cycleWeapon(),
        camp: () => this.endHunt('You head back to camp.'),
      }, {
        glass: has(this.state, 'binoculars'),
        call: ['grunt-call', 'box-call', 'duck-call'].some((c) => has(this.state, c)),
        stand: has(this.state, 'tree-stand'),
        swap: weapons.length > 1,
      });
    }

    if (this.area.lake) {
      if (has(this.state, 'decoys')) {
        this.decoyX = 260;
        for (let i = 0; i < 7; i++) {
          this.decoys.push(spriteImage(this, this.decoyX + i * 13 + (i % 2) * 5, WATER_Y - (i % 3), frameKey('mallard', 'swim')).setOrigin(0.5, 1).setDepth(9).setFlipX(i % 3 === 0));
        }
      }
      for (let i = 0; i < 2; i++) this.spawnFlock(Phaser.Math.Between(400, WORLD_W - 100), true);
    } else {
      for (let i = 0; i < 6; i++) this.spawnAnimal(Phaser.Math.Between(350, WORLD_W - 50));
    }
    if (!this.area.lake) this.addPerches();
    if (this.state.hasDog) {
      const sprite = spriteImage(this, 120, GROUND_Y, frameKey('dog', 'idle')).setOrigin(0.5, 1).setDepth(19);
      this.dog = { sprite, x: 120, y: GROUND_Y, task: null, phase: 'follow', anim: 0 };
    }
    if (this.area.hasSheds) {
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.6) {
          this.sheds.push(spriteImage(this, Phaser.Math.Between(400, WORLD_W - 100), GROUND_Y + 1, frameKey('shed', 'idle')).setOrigin(0.5, 1).setDepth(15));
        }
      }
    }
    this.startOfHuntChecks();
  }

  // ---------- Setup ----------

  /** A few songbirds on stumps along the trail: life at rest, until you get close. */
  private addPerches(): void {
    if (!this.textures.exists('stump')) {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 6;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#5a3f2c';
      ctx.fillRect(0, 1, 8, 5);
      ctx.fillStyle = '#c9a57a';
      ctx.fillRect(0, 0, 8, 2);
      ctx.fillStyle = '#3b2a20';
      ctx.fillRect(6, 1, 2, 5);
      this.textures.addCanvas('stump', c);
    }
    for (let i = 0; i < 4; i++) {
      const x = Phaser.Math.Between(300, WORLD_W - 200);
      spriteImage(this, x, GROUND_Y + 1, 'stump').setOrigin(0.5, 1).setDepth(14);
      const bird = this.add.image(x, GROUND_Y - 5, 'bird-up').setOrigin(0.5, 1).setDepth(15).setFlipX(Math.random() < 0.5);
      this.perched.push({ bird, x, y: GROUND_Y - 5, flying: false, t: Math.random() * 10, dir: 1 });
    }
  }

  private updatePerches(dt: number): void {
    for (const b of this.perched) {
      b.t += dt;
      if (!b.flying) {
        // A hop now and then, and a flush when the hunter comes within a few yards.
        b.bird.y = b.y - (Math.sin(b.t * 6) > 0.92 ? 1 : 0);
        if (Math.abs(this.player.x - b.x) < 70 && this.movement !== 'still') {
          b.flying = true;
          b.dir = this.player.x < b.x ? 1 : -1;
          b.bird.setFlipX(b.dir === -1);
        }
        continue;
      }
      b.x += b.dir * 70 * dt;
      b.y -= 50 * dt;
      b.bird.setPosition(Math.round(b.x), Math.round(b.y)).setTexture(Math.sin(b.t * 20) > 0 ? 'bird-up' : 'bird-down');
      b.bird.setTint(this.backdrop.light);
      if (b.y < -20) b.bird.setVisible(false);
    }
  }

  private playerKey(frame: string): string {
    return frameKey(has(this.state, 'orange-vest') ? 'orange' : 'hunter', frame);
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('A,D,LEFT,RIGHT,SHIFT,SPACE,S,DOWN,F,E,B,C,T,Q,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();

    kb.on('keydown-S', () => this.toggleCrouch());
    kb.on('keydown-DOWN', () => this.toggleCrouch());
    kb.on('keydown-F', () => this.setAiming(!this.aiming));
    kb.on('keydown-E', () => this.interact());
    kb.on('keydown-B', () => this.toggleGlassing());
    kb.on('keydown-C', () => this.useCall());
    kb.on('keydown-T', () => this.toggleStand());
    kb.on('keydown-Q', () => this.cycleWeapon());
    kb.on('keydown-ESC', () => this.endHunt('You head back to camp.'));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // On a touchscreen: touch and hold the scene to aim, let go to shoot. A quick tap walks there instead.
      if (p.wasTouch) return this.startTouchAim();
      if (p.rightButtonDown()) this.setAiming(!this.aiming);
      else if (this.aiming) this.fire();
    });
    const release = (p: Phaser.Input.Pointer) => p.wasTouch && this.endTouchAim(p);
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private lowerTouchAim(): void {
    if (!this.touchAim) return;
    this.touchAim = false;
    this.setAiming(false);
  }

  private startTouchAim(): void {
    if (this.ended) return;
    this.walkTo = null;
    if (!this.weapon()) return;
    this.touchAim = true;
    this.setAiming(true);
  }

  /**
   * Letting go: a held finger shoots, but only at an animal (over empty ground it just
   * lowers the weapon). A tap walks there, a second tap runs, a swipe down crouches.
   */
  private endTouchAim(p: Phaser.Input.Pointer): void {
    if (this.ended) return;
    const g = this.gestures.classify(p);
    if (g === 'hold') {
      // Fire while the touch still counts as held, so the shot uses the crosshair the player saw.
      if (this.touchAim) {
        const pt = this.reticlePoint();
        const onAnimal = this.animals.some((a) => a.mode !== 'down' && a.mode !== 'fall' && a.sprite.getBounds().contains(pt.x, pt.y));
        if (onAnimal) this.fire();
        else note('No animal under the crosshair, so you hold your fire.');
      }
      this.lowerTouchAim();
      return;
    }
    this.lowerTouchAim();
    if (g === 'swipe-down') return this.toggleCrouch();
    if (this.inStand || this.glassing) return;
    const x = this.cams.world.getWorldPoint(p.upX, p.upY).x;
    this.walkTo = { x: Phaser.Math.Clamp(x, 16, WORLD_W - 16), run: g === 'double-tap' };
  }

  private startOfHuntChecks(): void {
    if (this.state.harvests.length === 0) this.teachOnce('welcome');
    const weapon = this.weapon();
    if (!has(this.state, 'hunting-license') && weapon) this.teachOnce('no-license');
    if (this.area.orangeRequired && weapon?.weapon?.firearm && !has(this.state, 'orange-vest')) {
      const fine = Math.min(FINE_NO_ORANGE, this.state.money);
      this.state.money -= fine;
      this.summary.fines += fine;
      note(`🚓 A game warden stops you at the trailhead: no blaze orange. Fine: $${fine}.`);
      this.teachOnce('orange');
    }
    if (has(this.state, 'scent-spray')) {
      addItem(this.state, 'scent-spray', -1);
      this.scentSpray = true;
      note('You spray down with scent eliminator. Your scent cone is smaller today.');
    }
    if (this.area.lake) {
      note(has(this.state, 'decoys') ? 'You set your decoys out on the water in front of you.' : 'No decoys today. Ducks have less reason to land near you.');
      if (has(this.state, 'decoys')) this.teachOnce('decoys');
      if (this.dog) note('🐕 Biscuit sits by your boot, watching the sky.');
    }
    note(`${this.area.name}. Legal shooting light starts at ${formatHour(6)}. Watch the wind.`);
  }

  // ---------- Main loop ----------

  update(_time: number, deltaMs: number): void {
    if (this.ended) return;
    const dt = Math.min(deltaMs / 1000, 0.05);

    this.hour += dt * HOURS_PER_SEC;
    if (this.hour >= END_HOUR) return this.endHunt('Darkness falls. Time to head back to camp.');

    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windDir = this.windDir === 1 ? -1 : 1;
      this.windTimer = 60 + Math.random() * 60;
      note(`🍃 The wind shifted. It now blows to the ${this.windDir === 1 ? 'right →' : '← left'}.`);
    }

    this.updatePlayer(dt);
    this.updateAnimals(dt);
    this.updateDog(dt);
    this.updateSpawns(dt);
    this.updatePerches(dt);
    this.viewLeft = this.cams.follow(this.player.x, WORLD_W);
    this.backdrop.update(this.hour, this.viewLeft, dt, this.windDir);
    this.applyLight();
    this.drawScent();
    this.drawWeapon();
    this.drawReticle();
    this.updateHud();
  }

  private updatePlayer(dt: number): void {
    const k = this.keys;
    const left = k.A.isDown || k.LEFT.isDown || pad.left;
    const right = k.D.isDown || k.RIGHT.isDown || pad.right;
    const canMove = !this.aiming && !this.inStand && !this.glassing;
    let dir = 0;
    if (canMove && left !== right) dir = left ? -1 : 1;
    // Walking to a tapped spot, unless the keys or a stance change take over.
    if (dir !== 0 || !canMove) this.walkTo = null;
    const w = this.walkTo;
    if (w) {
      if (Math.abs(w.x - this.player.x) < 2) this.walkTo = null;
      else dir = w.x > this.player.x ? 1 : -1;
    }

    if (dir === 0) this.movement = 'still';
    else if (this.crouched) this.movement = 'sneak';
    else if (k.SHIFT.isDown || pad.run || w?.run) this.movement = 'run';
    else this.movement = 'walk';

    if (dir !== 0) {
      this.facing = dir as 1 | -1;
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * SPEED[this.movement] * dt, 16, WORLD_W - 16);
    }
    this.player.setFlipX(this.facing === -1);

    // Walk cycle: step, stand, other step, stand.
    this.walkAnim += dt * (this.movement === 'run' ? 12 : 7);
    const cycle = ['walk1', 'idle', 'walk2', 'idle'];
    const frame = this.crouched ? 'crouch' : this.movement === 'still' ? 'idle' : cycle[Math.floor(this.walkAnim) % 4];
    this.player.setTexture(this.playerKey(frame));
    this.player.y = this.inStand ? GROUND_Y - STAND_HEIGHT : GROUND_Y;

    // Holding your breath steadies your aim, but only for a few seconds.
    // On a touchscreen, holding your finger down is holding your breath.
    const holding = this.aiming && (k.SPACE.isDown || this.touchAim) && this.breath > 0;
    if (isTouch()) setTouchState(this.aiming, this.canInteract());
    this.breath = holding ? this.breath - dt : Math.min(BREATH_SECONDS, this.breath + dt * 0.8);
  }

  private updateAnimals(dt: number): void {
    for (const a of [...this.animals]) {
      const dx = a.x - this.player.x;
      const distYards = Math.abs(dx) / PX_PER_YARD;

      if (a.def.waterfowl) {
        this.updateDuck(a, dt, dx, distYards);
        continue;
      }
      if (a.mode === 'down') continue;

      if (a.mode === 'flee') {
        a.x += a.dir * a.def.fleeSpeed * PX_PER_YARD * dt;
        if (a.x < -60 || a.x > WORLD_W + 60 || distYards > 260) {
          this.removeAnimal(a);
          continue;
        }
      } else {
        const sense = senses(a.def, {
          distanceYards: distYards,
          movement: this.movement,
          inStand: this.inStand,
          windDir: this.windDir,
          animalSide: dx >= 0 ? 1 : -1,
          scentSpray: this.scentSpray,
        });
        a.awareness = Math.max(0, a.awareness + (sense.perSecond > 0 ? sense.perSecond : -0.15) * dt);

        if (a.awareness >= 1) {
          this.spook(a, sense.cause);
        } else if (a.awareness >= 0.5) {
          a.mode = 'alert';
          a.dir = dx >= 0 ? -1 : 1;
        } else if (a.mode === 'alert') {
          a.mode = 'idle';
          a.timer = 1;
        } else if (a.mode === 'curious') {
          a.timer -= dt;
          a.dir = dx >= 0 ? -1 : 1;
          if (distYards > 25) a.x += a.dir * a.def.walkSpeed * 1.3 * PX_PER_YARD * dt;
          if (a.timer <= 0) a.mode = 'idle';
        } else {
          a.timer -= dt;
          if (a.timer <= 0) {
            a.mode = Math.random() < 0.5 ? 'idle' : 'walk';
            a.timer = 2 + Math.random() * 4;
            if (a.mode === 'walk' && Math.random() < 0.5) a.dir = a.dir === 1 ? -1 : 1;
          }
          if (a.mode === 'walk') {
            a.x += a.dir * a.def.walkSpeed * PX_PER_YARD * dt;
            if (a.x < 30 || a.x > WORLD_W - 30) a.dir = a.dir === 1 ? -1 : 1;
          }
        }
      }

      if (distYards < 70 && this.onScreen(a.x) && !this.state.seenAnimals.includes(a.def.id)) {
        this.state.seenAnimals.push(a.def.id);
        note(`📓 New field guide entry: ${a.def.name}.`);
      }
      this.animateAnimal(a, dt, distYards);
    }
  }

  private animateAnimal(a: Animal, dt: number, distYards: number): void {
    const s = a.sprite;
    const moving = a.mode === 'walk' || a.mode === 'flee' || (a.mode === 'curious' && distYards > 25);
    a.anim += dt * (a.mode === 'flee' ? 12 : 5);
    s.setTexture(frameKey(a.def.id, moving && Math.floor(a.anim) % 2 ? 'walk' : 'idle'));
    s.setFlipX(a.dir === -1);
    // Small game hops; deer bound when running.
    const hops = SMALL_GAME.includes(a.def.id) || a.mode === 'flee';
    const hop = moving && hops ? Math.round(Math.abs(Math.sin(a.anim * Math.PI * 0.5)) * (a.mode === 'flee' ? 5 : 2)) : 0;
    s.setPosition(Math.round(a.x), GROUND_Y - hop);

    const far = distYards > CLEAR_SIGHT_YARDS && !this.glassing;
    s.setAlpha(far ? 0.45 : 1);
    a.icon.setPosition(Math.round(a.x), Math.round(s.y - s.displayHeight - 3));
    a.icon.setVisible(a.mode === 'flee' || a.mode === 'alert');
    a.icon.setTexture(frameKey('icon', a.mode === 'flee' ? 'flee' : 'alert'));
  }

  private spook(a: Animal, cause: Sense | null): void {
    if (a.mode === 'flee' || a.mode === 'down') return;
    a.mode = 'flee';
    a.dir = a.x >= this.player.x ? 1 : -1;
    if (cause && this.onScreen(a.x)) this.teachOnce(cause);
  }

  private updateSpawns(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 8;
    const alive = this.animals.filter((a) => a.mode !== 'down').length;
    if (alive >= MAX_ANIMALS) return;
    const tod = timeOfDay(this.hour);
    const ids = Object.keys(this.area.spawns);
    const avgActivity = ids.reduce((sum, id) => sum + animalDef(id).activity[tod], 0) / ids.length;
    if (Math.random() > avgActivity * 0.7) return;
    if (this.area.lake) {
      if (this.animals.filter((a) => a.mode !== 'down').length < MAX_ANIMALS) this.spawnFlock(0, false);
      return;
    }
    // Spawn just out of view so animals walk in rather than pop up.
    const side = Math.random() < 0.5 ? this.viewLeft - 60 : this.viewLeft + VIEW_W + 60;
    this.spawnAnimal(Phaser.Math.Clamp(side, 30, WORLD_W - 30));
  }

  private addAnimal(def: AnimalDef, x: number, y: number, mode: Mode, dir: 1 | -1): Animal {
    const sprite = spriteImage(this, x, y, frameKey(def.id, def.waterfowl ? 'swim' : 'idle')).setOrigin(0.5, 1).setDepth(10);
    const icon = spriteImage(this, x, 0, frameKey('icon', 'alert')).setOrigin(0.5, 1).setDepth(30).setVisible(false);
    const a: Animal = { def, sprite, icon, mode, dir, x, y, awareness: 0, timer: 15 + Math.random() * 25, anim: Math.random() * 4, drift: DRIFT_SECONDS };
    this.animals.push(a);
    return a;
  }

  /** A flock either rests on the water already, or flies in from off-screen. */
  private spawnFlock(x: number, onWater: boolean): void {
    const def = animalDef('mallard');
    const n = 2 + Math.floor(Math.random() * 4);
    const fromLeft = Math.random() < 0.5;
    const startX = onWater ? x : fromLeft ? this.viewLeft - 40 : this.viewLeft + VIEW_W + 40;
    const height = 50 + Math.random() * 60;
    // Decoys pull flocks in. Without them, most just pass over.
    let landX: number | undefined;
    if (this.decoys.length && Math.random() < 0.7) landX = this.decoyX + 40 + (Math.random() - 0.5) * 60;
    else if (Math.random() < 0.25) landX = this.viewLeft + 60 + Math.random() * (VIEW_W - 120);
    for (let i = 0; i < n; i++) {
      const dir: 1 | -1 = onWater ? (Math.random() < 0.5 ? 1 : -1) : fromLeft ? 1 : -1;
      const a = this.addAnimal(def, startX - dir * i * 14, onWater ? WATER_Y - (i % 2) * 3 : height + (i % 2) * 6 + i * 2, onWater ? 'swim' : 'fly', dir);
      if (landX !== undefined) a.landX = landX + i * 12;
    }
  }

  private updateDuck(a: Animal, dt: number, dx: number, distYards: number): void {
    const fly = a.def.fleeSpeed * PX_PER_YARD;
    if (a.mode === 'fall') {
      a.timer += dt;
      a.y = Math.min(WATER_Y, a.y + GRAVITY * a.timer * dt);
      a.x += a.dir * fly * 0.3 * dt;
      if (a.y >= WATER_Y) {
        a.mode = 'down';
        const splash = this.add.rectangle(Math.round(a.x), WATER_Y - 1, 10, 1, 0xffffff, 0.7).setDepth(11);
        this.tweens.add({ targets: splash, alpha: 0, scaleX: 2, duration: 600, onComplete: () => splash.destroy() });
        if (!this.dog && !has(this.state, 'waders')) this.teachOnce('retrieve', true);
      }
    } else if (a.mode === 'down') {
      if (a.carried) return;
      a.drift -= dt;
      a.x += Math.sin(this.time.now / 900) * 2 * dt;
      if (a.drift <= 0) {
        this.teachOnce('lost-bird', true);
        this.tweens.add({ targets: a.sprite, alpha: 0, duration: 800 });
        this.removeAnimal(a);
        return;
      }
    } else {
      const sense = senses(a.def, {
        distanceYards: distYards,
        movement: this.movement,
        inStand: false,
        windDir: this.windDir,
        animalSide: dx >= 0 ? 1 : -1,
        scentSpray: this.scentSpray,
      });
      a.awareness = Math.max(0, a.awareness + (sense.perSecond > 0 ? sense.perSecond : -0.15) * dt);
      if (a.awareness >= 1 && a.mode !== 'flee') {
        // Flush: jump off the water and climb away from the hunter.
        a.mode = 'flee';
        a.landX = undefined;
        a.dir = dx >= 0 ? 1 : -1;
        if (sense.cause && this.onScreen(a.x)) this.teachOnce(sense.cause);
      }

      if (a.mode === 'swim') {
        a.timer -= dt;
        a.x += a.dir * a.def.walkSpeed * PX_PER_YARD * dt;
        if (Math.random() < dt * 0.2) a.dir = a.dir === 1 ? -1 : 1;
        if (a.timer <= 0) {
          a.mode = 'flee';
          a.dir = Math.random() < 0.5 ? 1 : -1;
        }
      } else if (a.mode === 'fly' || a.mode === 'land') {
        if (a.landX !== undefined && Math.abs(a.x - a.landX) < 90) a.mode = 'land';
        const speed = a.mode === 'land' ? fly * Phaser.Math.Clamp(Math.abs(a.x - (a.landX ?? a.x)) / 90, 0.3, 1) : fly;
        a.x += a.dir * speed * dt;
        if (a.mode === 'land') {
          a.y = Math.min(WATER_Y, a.y + 45 * dt);
          if (a.y >= WATER_Y) {
            a.mode = 'swim';
            a.timer = 20 + Math.random() * 30;
          }
        } else {
          a.y += Math.sin(this.time.now / 300 + a.anim) * 6 * dt;
        }
      } else if (a.mode === 'flee') {
        a.x += a.dir * fly * dt;
        a.y = Math.max(30, a.y - 70 * dt);
      }
      if (a.x < -100 || a.x > WORLD_W + 100 || (a.mode !== 'swim' && distYards > 320)) {
        this.removeAnimal(a);
        return;
      }
    }

    if (distYards < 70 && this.onScreen(a.x) && !this.state.seenAnimals.includes(a.def.id)) {
      this.state.seenAnimals.push(a.def.id);
      note(`📓 New field guide entry: ${a.def.name}.`);
    }
    const s = a.sprite;
    a.anim += dt * 8;
    const flying = a.mode === 'fly' || a.mode === 'flee' || (a.mode === 'land' && a.y < WATER_Y - 4);
    s.setTexture(frameKey('mallard', flying ? (Math.floor(a.anim) % 2 ? 'up' : 'down') : a.mode === 'fall' ? 'up' : 'swim'));
    s.setFlipX(a.dir === -1).setFlipY(a.mode === 'down');
    s.setPosition(Math.round(a.x), Math.round(a.y));
    s.setAlpha(distYards > CLEAR_SIGHT_YARDS && !this.glassing ? 0.5 : 1);
    a.icon.setPosition(Math.round(a.x), Math.round(a.y - s.displayHeight - 3));
    a.icon.setVisible(a.mode === 'flee' && a.y > 60);
    a.icon.setTexture(frameKey('icon', 'flee'));
  }

  /** Biscuit follows you, and on the marsh swims out for downed ducks. */
  private updateDog(dt: number): void {
    const d = this.dog;
    if (!d) return;
    if (!d.task && d.phase === 'follow') {
      d.task = this.animals.find((a) => a.def.waterfowl && a.mode === 'down' && !a.carried) ?? null;
      if (d.task) {
        d.phase = 'out';
        note('🐕 Biscuit leaps into the water!');
      }
    }
    let targetX = this.player.x - this.facing * 16;
    let targetY = GROUND_Y;
    if (d.phase === 'out' && d.task) {
      targetX = d.task.x;
      targetY = Math.abs(d.x - d.task.x) < 6 ? d.task.y + 2 : GROUND_Y;
      if (Math.abs(d.x - d.task.x) < 3 && Math.abs(d.y - targetY) < 2) {
        d.task.carried = true;
        d.phase = 'back';
      }
    } else if (d.phase === 'back' && d.task) {
      targetY = GROUND_Y;
      targetX = d.y < GROUND_Y - 1 ? d.x : this.player.x - this.facing * 10;
      d.task.x = d.x + (d.sprite.flipX ? -8 : 8);
      d.task.y = d.y - 6;
      d.task.sprite.setPosition(Math.round(d.task.x), Math.round(d.task.y));
      if (Math.abs(d.x - targetX) < 4 && d.y >= GROUND_Y - 1) {
        this.collectDuck(d.task, '🐕 Biscuit drops the duck at your feet. Good dog!');
        this.teachOnce('dog');
        d.task = null;
        d.phase = 'follow';
      }
    }
    const busy = d.phase !== 'follow';
    const speed = busy ? 90 : Math.abs(targetX - d.x) > 60 ? 110 : 50;
    const dxDog = targetX - d.x;
    if (Math.abs(dxDog) > 3) {
      d.x += Math.sign(dxDog) * Math.min(Math.abs(dxDog), speed * dt);
      d.sprite.setFlipX(dxDog < 0);
    }
    if (Math.abs(targetY - d.y) > 0.5) d.y += Math.sign(targetY - d.y) * Math.min(Math.abs(targetY - d.y), 25 * dt);
    const swimming = d.y < GROUND_Y - 1;
    const moving = Math.abs(dxDog) > 3 || swimming;
    d.anim += dt * 9;
    d.sprite.setTexture(frameKey('dog', swimming ? 'swim' : moving && Math.floor(d.anim) % 2 ? 'run' : 'idle'));
    d.sprite.setPosition(Math.round(d.x), Math.round(d.y));
  }

  /** Harvest a retrieved duck: by dog, by wading, or picked up. */
  private collectDuck(a: Animal, message: string): void {
    const r = harvest(this.state, a.def, a.quality!, a.weaponId!);
    this.summary.harvested.push(`${a.def.name} (${a.quality})`);
    this.summary.meatLbs += r.meatLbs;
    for (const [id, q] of Object.entries(r.items)) this.summary.items[id] = (this.summary.items[id] ?? 0) + q;
    note(message);
    for (const l of r.lessons) this.teachOnce(l);
    this.removeAnimal(a);
  }

  private spawnAnimal(x: number): void {
    const tod = timeOfDay(this.hour);
    const entries = Object.entries(this.area.spawns).map(([id, w]) => [id, w * animalDef(id).activity[tod]] as const);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let id = entries[0][0];
    for (const [eid, w] of entries) {
      r -= w;
      if (r <= 0) {
        id = eid;
        break;
      }
    }
    const a = this.addAnimal(animalDef(id), x, GROUND_Y, 'idle', Math.random() < 0.5 ? 1 : -1);
    a.timer = Math.random() * 3;
  }

  private removeAnimal(a: Animal): void {
    a.sprite.destroy();
    a.icon.destroy();
    this.animals = this.animals.filter((x) => x !== a);
  }

  // ---------- Actions ----------

  private weapon() {
    return this.state.equippedWeapon ? item(this.state.equippedWeapon) : null;
  }

  private toggleCrouch(): void {
    if (this.inStand) return;
    this.crouched = !this.crouched;
  }

  private setAiming(on: boolean): void {
    if (on && !this.weapon()) {
      note("You aren't carrying a weapon. Buy one at the outfitter, then pick it in the journal.");
      return;
    }
    this.aiming = on;
    if (on) this.glassing = false;
    this.input.setDefaultCursor(on ? 'none' : 'default');
    // Zoom toward where the player is pointing; back out when they lower the weapon.
    const p = this.input.activePointer;
    if (on) this.cams.zoomTo(AIM_ZOOM, p.x / SCREEN_W, p.y / SCREEN_H);
    else this.cams.zoomTo(1);
  }

  private toggleGlassing(): void {
    if (!has(this.state, 'binoculars')) {
      note('You need binoculars to glass (B). The outfitter sells them.');
      return;
    }
    this.glassing = !this.glassing;
    if (this.glassing) {
      this.setAiming(false);
      this.teachOnce('binoculars');
    }
  }

  private reticlePoint(): Phaser.Math.Vector2 {
    const p = this.input.activePointer;
    const world = this.cams.world.getWorldPoint(p.x, p.y);
    const w = this.weapon()?.weapon;
    if (!w) return world;
    let sway = w.sway * (this.crouched ? 0.7 : 1) * (this.inStand ? 0.6 : 1);
    if (this.keys.SPACE.isDown || this.touchAim) sway *= this.breath > 0 ? 0.2 : 2;
    if (this.touchAim) world.y -= TOUCH_AIM_LIFT;
    const t = this.time.now / 1000;
    return new Phaser.Math.Vector2(world.x + Math.sin(t * 1.3) * sway + Math.sin(t * 3.1) * sway * 0.3, world.y + Math.cos(t * 1.7) * sway * 0.7);
  }

  private fire(): void {
    const weaponItem = this.weapon();
    const w = weaponItem?.weapon;
    if (!weaponItem || !w) return;
    const pt = this.reticlePoint();
    const target = this.animals.find((a) => a.mode !== 'down' && a.mode !== 'fall' && a.sprite.getBounds().contains(pt.x, pt.y));

    if (!target) {
      // A shot at nothing still has to be a legal, safe shot.
      if (!has(this.state, 'hunting-license')) return this.teachOnce('no-license', true);
      if (!isLegalLight(this.hour)) return this.teachOnce('shooting-hours', true);
      const loaded = anyLoadedAmmo(this.state, weaponItem.id);
      if (!loaded) return this.teachOnce('no-ammo', true);
      addItem(this.state, loaded, -1);
      this.shotEffects(pt, w.firearm);
      note('You fired at nothing. Only shoot when you have a clear, identified target.');
      return;
    }

    const distYards = Math.abs(target.x - this.player.x) / PX_PER_YARD;
    const check = checkShot(this.state, target.def, weaponItem.id, distYards, this.hour, target.def.waterfowl ? this.ducksDowned : 0);
    if (!check.ok) {
      note('✋ You lower your weapon.');
      return this.teachOnce(check.lesson!, true);
    }

    addItem(this.state, check.ammo!, -1);
    this.shotEffects(pt, w.firearm, target);

    const s = target.sprite;
    let col = Math.floor(pt.x - (s.x - s.displayWidth / 2));
    const row = Math.floor(pt.y - (s.y - s.displayHeight));
    if (s.flipX) col = s.displayWidth - 1 - col;
    const result = resolveShot(target.def, w.kind, zoneAt(target.def, col, row));

    if (result.result === 'clean' && target.def.waterfowl) {
      target.mode = 'fall';
      target.timer = 0;
      target.quality = result.quality;
      target.weaponId = weaponItem.id;
      target.icon.setVisible(false);
      this.ducksDowned++;
    } else if (result.result === 'clean') {
      target.mode = 'down';
      target.quality = result.quality;
      target.weaponId = weaponItem.id;
      s.setTexture(frameKey(target.def.id, 'idle')).setFlipY(true).setPosition(Math.round(target.x), GROUND_Y + 2).setAlpha(1);
      target.icon.setVisible(false);
    } else {
      target.mode = 'flee';
      target.dir = target.x >= this.player.x ? 1 : -1;
      if (result.result === 'wounded') note(`The ${target.def.name.toLowerCase()} was wounded and ran off.`);
    }
    const flying = target.def.waterfowl && target.mode !== 'fall' && target.y < WATER_Y - 4;
    const shown = result.result === 'miss' && flying ? 'lead-bird' : result.result === 'clean' && target.def.waterfowl ? 'duck-down' : result.lesson;
    this.teachOnce(shown, true);
  }

  private shotEffects(pt: Phaser.Math.Vector2, firearm: boolean, target?: Animal): void {
    const tip = this.weaponTip();
    const flash = this.add.rectangle(Math.round(tip.x), Math.round(tip.y), firearm ? 4 : 2, firearm ? 3 : 1, 0xfff1a8).setDepth(25);
    this.tweens.add({ targets: flash, alpha: 0, duration: 90, onComplete: () => flash.destroy() });
    const puff = this.add.rectangle(Math.round(pt.x), Math.round(pt.y), 2, 2, 0xffffff, 0.9).setDepth(26);
    this.tweens.add({ targets: puff, alpha: 0, duration: 250, onComplete: () => puff.destroy() });
    if (firearm) this.cams.shake(120, 0.006);

    // Noise spooks animals nearby: a gunshot carries much farther than a bowstring.
    const range = (firearm ? 160 : 30) * PX_PER_YARD;
    let spooked = false;
    for (const a of this.animals) {
      if (a === target || a.mode === 'down' || a.mode === 'flee') continue;
      if (Math.abs(a.x - this.player.x) < range) {
        this.spook(a, null);
        spooked = true;
      }
    }
    if (spooked && firearm) this.teachOnce('gunshot');
  }

  /** Something within reach to tag, pick up or retrieve. */
  private canInteract(): boolean {
    return (
      this.animals.some((a) => a.mode === 'down' && !a.carried && this.near(a.x)) || this.sheds.some((s) => this.near(s.x))
    );
  }

  private near(x: number): boolean {
    return Math.abs(x - this.player.x) < REACH && !this.inStand;
  }

  private interact(): void {
    const duck = this.animals.find((a) => a.def.waterfowl && a.mode === 'down' && !a.carried && this.near(a.x));
    if (duck) {
      if (this.dog) return note('🐕 Biscuit has it. Let her work.');
      if (!has(this.state, 'waders')) return this.teachOnce('retrieve', true);
      // Wading out takes time and flushes nearby ducks.
      this.hour += 0.15;
      for (const a of this.animals) if (a.mode === 'swim' && Math.abs(a.x - this.player.x) < 120 * PX_PER_YARD) a.awareness = 1;
      return this.collectDuck(duck, 'You wade out in your waders and pick up the duck.');
    }
    const down = this.animals.find((a) => a.mode === 'down' && !a.def.waterfowl && this.near(a.x));
    if (down) {
      if (down.def.tag && !has(this.state, down.def.tag)) return this.teachOnce('no-tag', true);
      const r = harvest(this.state, down.def, down.quality!, down.weaponId!);
      this.summary.harvested.push(`${down.def.name} (${down.quality})`);
      this.summary.meatLbs += r.meatLbs;
      for (const [id, q] of Object.entries(r.items)) this.summary.items[id] = (this.summary.items[id] ?? 0) + q;
      const got = Object.entries(r.items).map(([id, q]) => `${item(id).name} ×${q}`).join(', ');
      note(`${down.def.tag ? '🏷️ Tagged. ' : ''}Field dressed: ${got || 'no parts'} + ${r.meatLbs} lbs ${down.def.meatName.toLowerCase()}.`);
      for (const l of r.lessons) this.teachOnce(l);
      this.tweens.add({ targets: down.sprite, alpha: 0, duration: 500, onComplete: () => this.removeAnimal(down) });
      return;
    }
    const shed = this.sheds.find((s) => this.near(s.x));
    if (shed) {
      addItem(this.state, 'shed-antler', 1);
      this.summary.items['shed-antler'] = (this.summary.items['shed-antler'] ?? 0) + 1;
      shed.destroy();
      this.sheds = this.sheds.filter((s) => s !== shed);
      this.teachOnce('shed');
    }
  }

  private useCall(): void {
    const calls: [string, string[]][] = [
      ['grunt-call', ['buck', 'doe']],
      ['box-call', ['turkey']],
      ['duck-call', ['mallard']],
    ];
    const owned = calls.filter(([id]) => has(this.state, id));
    if (!owned.length) return note('You have no game calls. The outfitter sells grunt calls and box calls.');
    // Calling again too soon makes animals suspicious.
    const tooSoon = this.time.now - this.lastCall < 15000;
    this.lastCall = this.time.now;
    const targets = owned.flatMap(([, ids]) => ids);
    let answered = 0;
    for (const a of this.animals) {
      if (!targets.includes(a.def.id) || a.mode === 'down' || a.mode === 'flee') continue;
      if (Math.abs(a.x - this.player.x) / PX_PER_YARD > 220) continue;
      if (tooSoon) a.awareness += 0.35;
      else if (a.def.waterfowl) {
        // Passing ducks swing around toward the caller.
        if (a.mode === 'fly' && a.landX === undefined) {
          a.landX = (this.decoys.length ? this.decoyX + 40 : this.player.x + this.facing * 50) + Math.random() * 30;
          a.dir = a.landX > a.x ? 1 : -1;
          answered++;
        }
      } else if (a.mode !== 'alert') {
        a.mode = 'curious';
        a.timer = 10;
        answered++;
      }
    }
    if (tooSoon) note('📯 You call again too soon. Nearby animals grow suspicious.');
    else note(answered ? `📯 You call. ${answered} animal${answered > 1 ? 's' : ''} come${answered > 1 ? '' : 's'} to look.` : '📯 You call. Nothing answers.');
    this.teachOnce('call');
  }

  private toggleStand(): void {
    if (this.inStand) {
      this.inStand = false;
      this.standGfx.clear();
      return;
    }
    if (!has(this.state, 'tree-stand')) return note('You need a tree stand (T). The outfitter sells them.');
    if (!has(this.state, 'harness')) return this.teachOnce('harness', true);
    this.inStand = true;
    this.crouched = false;
    const x = Math.round(this.player.x - this.facing * 7);
    const g = this.standGfx;
    g.clear();
    g.fillStyle(0x4a3424).fillRect(x - 4, 0, 8, GROUND_Y + 2);
    g.fillStyle(0x614532).fillRect(x - 4, 0, 2, GROUND_Y + 2);
    g.fillStyle(0x2b2b2b).fillRect(Math.round(this.player.x) - 9, GROUND_Y - STAND_HEIGHT, 18, 2);
    g.fillStyle(0x3a3a3a).fillRect(Math.round(this.player.x) - 9, GROUND_Y - STAND_HEIGHT + 2, 1, 8);
    this.teachOnce('tree-stand');
  }

  private cycleWeapon(): void {
    const owned = ['rifle-22', 'shotgun-20', 'rifle-308', 'bow'].filter((id) => has(this.state, id));
    if (owned.length < 2) return;
    const i = owned.indexOf(this.state.equippedWeapon ?? '');
    this.state.equippedWeapon = owned[(i + 1) % owned.length];
    note(`Now carrying: ${item(this.state.equippedWeapon).name}.`);
  }

  /** Teach a lesson. Reminders of a lesson already learned show once per hunt unless forced. */
  private teachOnce(id: string, force = false): void {
    if (!force && this.taughtThisHunt.has(id) && this.state.lessons.includes(id)) return;
    this.taughtThisHunt.add(id);
    teach(this.state, id);
  }

  private endHunt(message: string): void {
    if (this.ended) return;
    this.ended = true;
    this.input.setDefaultCursor('default');
    this.summary.newLessons = this.state.lessons.length - this.lessonsAtStart;
    clearHud();
    note(message);
    this.cams.fadeOut(600, () => this.onEnd(this.summary));
  }

  // ---------- Drawing ----------

  /** World position to screen position in game pixels, allowing for zoom. */
  private toScreen(x: number, y: number): { x: number; y: number } {
    const c = this.cams.world;
    const ox = c.width * c.originX;
    const oy = c.height * c.originY;
    return { x: (x - c.scrollX - ox) * c.zoom + ox, y: (y - c.scrollY - oy) * c.zoom + oy };
  }

  private onScreen(x: number): boolean {
    const cam = this.cams.world;
    return x > cam.worldView.x && x < cam.worldView.right;
  }

  /** Characters share the scene light so they sit in the same world as the scenery. */
  private applyLight(): void {
    const light = this.backdrop.light;
    this.player.setTint(light);
    for (const a of this.animals) a.sprite.setTint(a.mode === 'down' ? Phaser.Display.Color.ValueToColor(light).darken(15).color : light);
    for (const s of this.sheds) s.setTint(light);
    // Decoys are painted plastic: a little duller than the real thing.
    for (const d of this.decoys) d.setTint(Phaser.Display.Color.ValueToColor(light).darken(28).color);
    this.dog?.sprite.setTint(light);
  }

  /** A faint cone shows where your scent drifts, so you can learn to play the wind. */
  private drawScent(): void {
    const g = this.scentGfx;
    g.clear();
    const len = 160 * PX_PER_YARD * (this.scentSpray ? 0.45 : 1) * (this.inStand ? 0.5 : 1);
    const x = this.player.x;
    const y = this.player.y - 14;
    g.fillStyle(0xe8f0d8, 0.06);
    g.fillTriangle(x, y, x + this.windDir * len, y - 34, x + this.windDir * len, y + 24);
    const t = (this.time.now / 1000) % 1;
    g.fillStyle(0xe8f0d8, 0.35);
    for (let i = 0; i < 7; i++) {
      const f = (i / 7 + t) % 1;
      g.fillRect(Math.round(x + this.windDir * len * f), Math.round(y - 4 + Math.sin(f * 12 + i) * 14 * f), 1, 1);
    }
  }

  /** Where the hunter's front hand is, in world pixels. */
  private hand(): Phaser.Math.Vector2 {
    const s = this.player;
    const col = this.facing === 1 ? HAND.x : s.displayWidth - 1 - HAND.x;
    return new Phaser.Math.Vector2(s.x - s.displayWidth / 2 + col, s.y - s.displayHeight + HAND.y);
  }

  /** The weapon's angle: pointed at the crosshair while aiming, carried muzzle up otherwise. */
  private weaponAngle(): number {
    if (this.aiming) {
      const h = this.hand();
      const p = this.reticlePoint();
      let a = Math.atan2(p.y - h.y, (p.x - h.x) * this.facing);
      a = Phaser.Math.Clamp(a, -1.1, 0.9);
      return a;
    }
    // Carried muzzle up: the safe way to walk with a gun.
    return -0.75;
  }

  private weaponTip(): Phaser.Math.Vector2 {
    const h = this.hand();
    const a = this.weaponAngle();
    const len = this.state.equippedWeapon === 'bow' ? 2 : 12;
    return new Phaser.Math.Vector2(h.x + Math.cos(a) * len * this.facing, h.y + Math.sin(a) * len);
  }

  /** The rifle, shotgun or bow in the hunter's hands, lit like the scene. */
  private drawWeapon(): void {
    const g = this.weaponGfx;
    g.clear();
    const id = this.state.equippedWeapon;
    if (!id || this.ended) return;
    const light = Phaser.Display.Color.IntegerToColor(this.backdrop.light);
    const lit = (c: number) => {
      const k = Phaser.Display.Color.IntegerToColor(c);
      return Phaser.Display.Color.GetColor((k.red * light.red) / 255, (k.green * light.green) / 255, (k.blue * light.blue) / 255);
    };
    const h = this.hand();
    const a = this.weaponAngle();
    const dx = Math.cos(a) * this.facing;
    const dy = Math.sin(a);
    const at = (d: number, off = 0) => new Phaser.Math.Vector2(h.x + dx * d - dy * off * this.facing, h.y + dy * d + dx * off * this.facing);
    if (id === 'bow') {
      // A compound bow held upright, with cams top and bottom and the string drawn back.
      const top = at(0, -9);
      const bottom = at(0, 9);
      const curve = new Phaser.Curves.QuadraticBezier(top, at(4, 0), bottom);
      g.lineStyle(2, lit(0x3a3a42), 1);
      curve.draw(g, 10);
      g.fillStyle(lit(0x8a6a48), 1).fillRect(Math.round(h.x) - 1, Math.round(h.y) - 2, 2, 4);
      g.lineStyle(1, lit(0xd8d8d0), 0.9);
      const pull = this.aiming ? -4 : 0;
      g.lineBetween(top.x, top.y, at(pull).x, at(pull).y).lineBetween(at(pull).x, at(pull).y, bottom.x, bottom.y);
      return;
    }
    const shotgun = id === 'shotgun-20';
    // Wooden stock tucked back under the arm, then the action and barrel.
    const stockEnd = at(-7, 1);
    g.lineStyle(2, lit(0x6a4024), 1).lineBetween(stockEnd.x, stockEnd.y, h.x, h.y);
    g.lineStyle(1, lit(0xa06a3a), 1).lineBetween(at(-6, 0).x, at(-6, 0).y, h.x, h.y - 1);
    const barrelEnd = at(shotgun ? 12 : 13, -1);
    g.lineStyle(shotgun ? 2 : 1, lit(0x3a3a42), 1).lineBetween(at(1, -1).x, at(1, -1).y, barrelEnd.x, barrelEnd.y);
    g.lineStyle(1, lit(0x8e8e9a), 1).lineBetween(at(2, -2).x, at(2, -2).y, at(6, -2).x, at(6, -2).y);
    if (id === 'rifle-308') {
      // Scope.
      g.lineStyle(2, lit(0x24242a), 1).lineBetween(at(1, -3).x, at(1, -3).y, at(7, -3).x, at(7, -3).y);
    }
  }

  private drawReticle(): void {
    const g = this.reticle;
    g.clear();
    if (!this.aiming) return;
    const p = this.reticlePoint();
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x - 7, y + 1, 5, 1).fillRect(x + 3, y + 1, 5, 1).fillRect(x + 1, y - 7, 1, 5).fillRect(x + 1, y + 3, 1, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRect(x - 8, y, 5, 1).fillRect(x + 4, y, 5, 1).fillRect(x, y - 8, 1, 5).fillRect(x, y + 4, 1, 5);
    g.fillStyle(0xff3b30, 1).fillRect(x, y, 1, 1);
  }

  private updateHud(): void {
    const w = this.weapon();
    const ammo = w?.weapon ? w.weapon.ammo.map((a) => `${count(this.state, a)} ${AMMO_SHORT[a] ?? a}`).join(', ') : '';
    const tags = ['deer-tag', 'turkey-tag'].filter((t) => has(this.state, t)).map((t) => `${item(t).name.replace(' Tag', '')} ×${count(this.state, t)}`);
    const legal = isLegalLight(this.hour);

    const touch = isTouch();
    let hint = this.aiming
      ? touch ? 'Slide to put the crosshair on the animal · let go to shoot' : 'Click: shoot · hold Space: hold breath · F: lower'
      : touch ? (this.weapon() ? 'Tap to walk · hold to aim, let go to shoot · swipe down to crouch' : 'Tap to walk · tap twice to run · swipe down to crouch') : 'A/D move · Shift run · S crouch · F aim · B glass · C call · T stand · Esc camp';
    const duckDown = this.animals.some((a) => a.def.waterfowl && a.mode === 'down' && !a.carried);
    if (duckDown && this.dog) hint = 'Duck down! Biscuit is on it';
    else if (duckDown && this.animals.some((a) => a.def.waterfowl && a.mode === 'down' && this.near(a.x))) hint = has(this.state, 'waders') ? (touch ? 'Tap ✋ to wade out and retrieve' : 'Press E to wade out and retrieve') : 'You need waders or a dog to reach it';
    else if (duckDown) hint = 'Duck down on the water: walk over to it';
    else if (this.animals.some((a) => a.mode === 'down' && this.near(a.x))) hint = touch ? 'Tap ✋ to tag and field dress' : 'Press E to tag and field dress';
    else if (this.sheds.some((s) => this.near(s.x))) hint = touch ? 'A shed antler! Tap ✋ to pick it up' : 'A shed antler! Press E to pick it up';

    setHud({
      time: formatHour(this.hour),
      legal,
      wind: this.windDir,
      weapon: w ? `${w.name} · ${ammo}` : 'No weapon',
      tags: tags.join(' · '),
      stance: [this.inStand ? 'in tree stand' : '', this.glassing ? 'glassing' : ''].filter(Boolean).join(' · '),
      breath: this.aiming ? this.breath / BREATH_SECONDS : null,
      hint,
    });

    const labels: Label[] = [];
    if (this.glassing) {
      for (const a of this.animals) {
        if (a.mode === 'down' || a.mode === 'flee' || !this.onScreen(a.x)) continue;
        const d = Math.abs(a.x - this.player.x) / PX_PER_YARD;
        const check = checkShot(this.state, a.def, this.state.equippedWeapon, d, this.hour, a.def.waterfowl ? this.ducksDowned : 0);
        const at = this.toScreen(a.x, a.sprite.y - a.sprite.displayHeight - 4);
        labels.push({
          x: at.x,
          y: at.y,
          title: a.def.name,
          detail: `${Math.round(d)} yd · ${check.ok ? 'clear to shoot' : lesson(check.lesson!).title}`,
          ok: check.ok,
        });
      }
    }
    setLabels(labels);
  }
}
