import Phaser from 'phaser';
import { Backdrop } from '../art/backdrop';
import { createSprites, frameKey } from '../art/sprites';
import { GROUND_Y, VIEW_W, WATER_Y } from '../art/view';
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
import { hideTouch, isTouch, pad, setTouchAiming, showTouch } from '../ui/touch';

const WORLD_W = 2400;
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
    this.decoys = [];
    this.ducksDowned = 0;
    this.summary = { areaName: this.area.name, harvested: [], items: {}, meatLbs: 0, fines: 0, newLessons: 0 };
  }

  create(): void {
    createSprites(this);
    this.backdrop = new Backdrop(this, { scrolling: true, lake: this.area.lake });
    this.scentGfx = this.add.graphics().setDepth(5);
    this.standGfx = this.add.graphics().setDepth(18);
    this.reticle = this.add.graphics().setDepth(60);

    this.player = this.add.image(150, GROUND_Y, this.playerKey('idle')).setOrigin(0.5, 1).setDepth(20);
    this.cameras.main.setBounds(0, 0, WORLD_W, 270);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearHud();
      hideTouch();
    });
    if (isTouch()) {
      showTouch({
        aim: () => this.setAiming(!this.aiming),
        fire: () => this.aiming && this.fire(),
        crouch: () => this.toggleCrouch(),
        act: () => this.interact(),
        glass: () => this.toggleGlassing(),
        call: () => this.useCall(),
        stand: () => this.toggleStand(),
        swap: () => this.cycleWeapon(),
        camp: () => this.endHunt('You head back to camp.'),
      });
    }

    if (this.area.lake) {
      if (has(this.state, 'decoys')) {
        this.decoyX = 260;
        for (let i = 0; i < 7; i++) {
          this.decoys.push(this.add.image(this.decoyX + i * 13 + (i % 2) * 5, WATER_Y - (i % 3), frameKey('mallard', 'swim')).setOrigin(0.5, 1).setDepth(9).setFlipX(i % 3 === 0));
        }
      }
      for (let i = 0; i < 2; i++) this.spawnFlock(Phaser.Math.Between(400, WORLD_W - 100), true);
    } else {
      for (let i = 0; i < 6; i++) this.spawnAnimal(Phaser.Math.Between(350, WORLD_W - 50));
    }
    if (this.state.hasDog) {
      const sprite = this.add.image(120, GROUND_Y, frameKey('dog', 'idle')).setOrigin(0.5, 1).setDepth(19);
      this.dog = { sprite, x: 120, y: GROUND_Y, task: null, phase: 'follow', anim: 0 };
    }
    if (this.area.hasSheds) {
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.6) {
          this.sheds.push(this.add.image(Phaser.Math.Between(400, WORLD_W - 100), GROUND_Y + 1, frameKey('shed', 'idle')).setOrigin(0.5, 1).setDepth(15));
        }
      }
    }
    this.startOfHuntChecks();
  }

  // ---------- Setup ----------

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
      // On a touchscreen, touching the scene only moves the reticle; the Fire button shoots.
      if (p.wasTouch) return;
      if (p.rightButtonDown()) this.setAiming(!this.aiming);
      else if (this.aiming) this.fire();
    });
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
    this.backdrop.update(this.hour, this.cameras.main.scrollX, dt, this.windDir);
    this.applyLight();
    this.drawScent();
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

    if (dir === 0) this.movement = 'still';
    else if (this.crouched) this.movement = 'sneak';
    else if (k.SHIFT.isDown || pad.run) this.movement = 'run';
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
    const holding = this.aiming && (k.SPACE.isDown || pad.breath) && this.breath > 0;
    setTouchAiming(this.aiming);
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
    a.icon.setPosition(Math.round(a.x), Math.round(s.y - s.height - 3));
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
    const cam = this.cameras.main;
    const side = Math.random() < 0.5 ? cam.scrollX - 60 : cam.scrollX + VIEW_W + 60;
    this.spawnAnimal(Phaser.Math.Clamp(side, 30, WORLD_W - 30));
  }

  private addAnimal(def: AnimalDef, x: number, y: number, mode: Mode, dir: 1 | -1): Animal {
    const sprite = this.add.image(x, y, frameKey(def.id, def.waterfowl ? 'swim' : 'idle')).setOrigin(0.5, 1).setDepth(10);
    const icon = this.add.image(x, 0, frameKey('icon', 'alert')).setOrigin(0.5, 1).setDepth(30).setVisible(false);
    const a: Animal = { def, sprite, icon, mode, dir, x, y, awareness: 0, timer: 15 + Math.random() * 25, anim: Math.random() * 4, drift: DRIFT_SECONDS };
    this.animals.push(a);
    return a;
  }

  /** A flock either rests on the water already, or flies in from off-screen. */
  private spawnFlock(x: number, onWater: boolean): void {
    const def = animalDef('mallard');
    const n = 2 + Math.floor(Math.random() * 4);
    const cam = this.cameras.main;
    const fromLeft = Math.random() < 0.5;
    const startX = onWater ? x : fromLeft ? cam.scrollX - 40 : cam.scrollX + VIEW_W + 40;
    const height = 50 + Math.random() * 60;
    // Decoys pull flocks in. Without them, most just pass over.
    let landX: number | undefined;
    if (this.decoys.length && Math.random() < 0.7) landX = this.decoyX + 40 + (Math.random() - 0.5) * 60;
    else if (Math.random() < 0.25) landX = cam.scrollX + 60 + Math.random() * (VIEW_W - 120);
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
    a.icon.setPosition(Math.round(a.x), Math.round(a.y - s.height - 3));
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
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const w = this.weapon()?.weapon;
    if (!w) return world;
    let sway = w.sway * (this.crouched ? 0.7 : 1) * (this.inStand ? 0.6 : 1);
    if (this.keys.SPACE.isDown || pad.breath) sway *= this.breath > 0 ? 0.2 : 2;
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
    let col = Math.floor(pt.x - (s.x - s.width / 2));
    const row = Math.floor(pt.y - (s.y - s.height));
    if (s.flipX) col = s.width - 1 - col;
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
    const muzzleY = this.player.y - (this.crouched ? 8 : 11);
    const flash = this.add.rectangle(Math.round(this.player.x + this.facing * 10), muzzleY, firearm ? 4 : 2, firearm ? 3 : 1, 0xfff1a8).setDepth(25);
    this.tweens.add({ targets: flash, alpha: 0, duration: 90, onComplete: () => flash.destroy() });
    const puff = this.add.rectangle(Math.round(pt.x), Math.round(pt.y), 2, 2, 0xffffff, 0.9).setDepth(26);
    this.tweens.add({ targets: puff, alpha: 0, duration: 250, onComplete: () => puff.destroy() });
    if (firearm) this.cameras.main.shake(120, 0.006);

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
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.onEnd(this.summary));
  }

  // ---------- Drawing ----------

  private onScreen(x: number): boolean {
    const cam = this.cameras.main;
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
      ? touch ? 'Drag on the scene to aim · hold breath, then Fire' : 'Click: shoot · hold Space: hold breath · F: lower'
      : touch ? 'Walk slowly, crouch, and keep the wind in your face' : 'A/D move · Shift run · S crouch · F aim · B glass · C call · T stand · Esc camp';
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
      stance: `${this.inStand ? 'Tree stand' : this.crouched ? 'Crouched' : 'Standing'} · ${this.movement}${this.glassing ? ' · glassing' : ''}`,
      breath: this.aiming ? this.breath / BREATH_SECONDS : null,
      hint,
    });

    const labels: Label[] = [];
    if (this.glassing) {
      const cam = this.cameras.main;
      for (const a of this.animals) {
        if (a.mode === 'down' || a.mode === 'flee' || !this.onScreen(a.x)) continue;
        const d = Math.abs(a.x - this.player.x) / PX_PER_YARD;
        const check = checkShot(this.state, a.def, this.state.equippedWeapon, d, this.hour, a.def.waterfowl ? this.ducksDowned : 0);
        labels.push({
          x: a.x - cam.scrollX,
          y: a.sprite.y - a.sprite.height - 4,
          title: a.def.name,
          detail: `${Math.round(d)} yd · ${check.ok ? 'clear to shoot' : lesson(check.lesson!).title}`,
          ok: check.ok,
        });
      }
    }
    setLabels(labels);
  }
}
