import Phaser from 'phaser';
import { Backdrop } from '../art/backdrop';
import { createSprites, frameKey } from '../art/sprites';
import { GROUND_Y, VIEW_W } from '../art/view';
import {
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

type Mode = 'idle' | 'walk' | 'alert' | 'curious' | 'flee' | 'down';

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
    this.summary = { areaName: this.area.name, harvested: [], items: {}, meatLbs: 0, fines: 0, newLessons: 0 };
  }

  create(): void {
    createSprites(this);
    this.backdrop = new Backdrop(this, { scrolling: true });
    this.scentGfx = this.add.graphics().setDepth(5);
    this.standGfx = this.add.graphics().setDepth(18);
    this.reticle = this.add.graphics().setDepth(60);

    this.player = this.add.image(150, GROUND_Y, this.playerKey('idle')).setOrigin(0.5, 1).setDepth(20);
    this.cameras.main.setBounds(0, 0, WORLD_W, 270);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearHud());

    for (let i = 0; i < 6; i++) this.spawnAnimal(Phaser.Math.Between(350, WORLD_W - 50));
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
    this.updateSpawns(dt);
    this.backdrop.update(this.hour, this.cameras.main.scrollX, dt, this.windDir);
    this.applyLight();
    this.drawScent();
    this.drawReticle();
    this.updateHud();
  }

  private updatePlayer(dt: number): void {
    const k = this.keys;
    const left = k.A.isDown || k.LEFT.isDown;
    const right = k.D.isDown || k.RIGHT.isDown;
    const canMove = !this.aiming && !this.inStand && !this.glassing;
    let dir = 0;
    if (canMove && left !== right) dir = left ? -1 : 1;

    if (dir === 0) this.movement = 'still';
    else if (this.crouched) this.movement = 'sneak';
    else if (k.SHIFT.isDown) this.movement = 'run';
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
    const holding = this.aiming && k.SPACE.isDown && this.breath > 0;
    this.breath = holding ? this.breath - dt : Math.min(BREATH_SECONDS, this.breath + dt * 0.8);
  }

  private updateAnimals(dt: number): void {
    for (const a of [...this.animals]) {
      const dx = a.x - this.player.x;
      const distYards = Math.abs(dx) / PX_PER_YARD;

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
    // Spawn just out of view so animals walk in rather than pop up.
    const cam = this.cameras.main;
    const side = Math.random() < 0.5 ? cam.scrollX - 60 : cam.scrollX + VIEW_W + 60;
    this.spawnAnimal(Phaser.Math.Clamp(side, 30, WORLD_W - 30));
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
    const def = animalDef(id);
    const sprite = this.add.image(x, GROUND_Y, frameKey(id, 'idle')).setOrigin(0.5, 1).setDepth(10);
    const icon = this.add.image(x, 0, frameKey('icon', 'alert')).setOrigin(0.5, 1).setDepth(30).setVisible(false);
    this.animals.push({ def, sprite, icon, mode: 'idle', dir: Math.random() < 0.5 ? 1 : -1, x, awareness: 0, timer: Math.random() * 3, anim: Math.random() * 4 });
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
    if (this.keys.SPACE.isDown) sway *= this.breath > 0 ? 0.2 : 2;
    const t = this.time.now / 1000;
    return new Phaser.Math.Vector2(world.x + Math.sin(t * 1.3) * sway + Math.sin(t * 3.1) * sway * 0.3, world.y + Math.cos(t * 1.7) * sway * 0.7);
  }

  private fire(): void {
    const weaponItem = this.weapon();
    const w = weaponItem?.weapon;
    if (!weaponItem || !w) return;
    const pt = this.reticlePoint();
    const target = this.animals.find((a) => a.mode !== 'down' && a.sprite.getBounds().contains(pt.x, pt.y));

    if (!target) {
      // A shot at nothing still has to be a legal, safe shot.
      if (!has(this.state, 'hunting-license')) return this.teachOnce('no-license', true);
      if (!isLegalLight(this.hour)) return this.teachOnce('shooting-hours', true);
      if (count(this.state, w.ammo) <= 0) return this.teachOnce('no-ammo', true);
      addItem(this.state, w.ammo, -1);
      this.shotEffects(pt, w.firearm);
      note('You fired at nothing. Only shoot when you have a clear, identified target.');
      return;
    }

    const distYards = Math.abs(target.x - this.player.x) / PX_PER_YARD;
    const check = checkShot(this.state, target.def, weaponItem.id, distYards, this.hour);
    if (!check.ok) {
      note('✋ You lower your weapon.');
      return this.teachOnce(check.lesson!, true);
    }

    addItem(this.state, w.ammo, -1);
    this.shotEffects(pt, w.firearm, target);

    const s = target.sprite;
    let col = Math.floor(pt.x - (s.x - s.width / 2));
    const row = Math.floor(pt.y - (s.y - s.height));
    if (s.flipX) col = s.width - 1 - col;
    const result = resolveShot(target.def, w.kind, zoneAt(target.def, col, row));

    if (result.result === 'clean') {
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
    this.teachOnce(result.lesson, true);
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
    const down = this.animals.find((a) => a.mode === 'down' && this.near(a.x));
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
      else if (a.mode !== 'alert') {
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
    const ammo = w?.weapon ? count(this.state, w.weapon.ammo) : 0;
    const tags = ['deer-tag', 'turkey-tag'].filter((t) => has(this.state, t)).map((t) => `${item(t).name.replace(' Tag', '')} ×${count(this.state, t)}`);
    const legal = isLegalLight(this.hour);

    let hint = this.aiming
      ? 'Click: shoot · hold Space: hold breath · F: lower'
      : 'A/D move · Shift run · S crouch · F aim · B glass · C call · T stand · Esc camp';
    if (this.animals.some((a) => a.mode === 'down' && this.near(a.x))) hint = 'Press E to tag and field dress';
    else if (this.sheds.some((s) => this.near(s.x))) hint = 'A shed antler! Press E to pick it up';

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
        const check = checkShot(this.state, a.def, this.state.equippedWeapon, d, this.hour);
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
