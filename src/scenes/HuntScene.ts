import Phaser from 'phaser';
import { createTextures, LAYER_W, SCALE } from '../art/sprites';
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
import { VIEW_H, VIEW_W } from './CampScene';

const WORLD_W = 4800;
const GROUND_Y = 432;
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

const SPEED: Record<Movement, number> = { still: 0, sneak: 45, walk: 95, run: 210 };

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
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  mode: Mode;
  dir: 1 | -1;
  awareness: number;
  timer: number;
  quality?: Quality;
  weaponId?: string;
}

export class HuntScene extends Phaser.Scene {
  private state!: GameState;
  private area!: AreaDef;
  private onEnd!: (s: HuntSummary) => void;

  private player!: Phaser.GameObjects.Image;
  private standGfx!: Phaser.GameObjects.Graphics;
  private scentGfx!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Graphics;
  private layers: [Phaser.GameObjects.TileSprite, number][] = [];
  private sky!: Phaser.GameObjects.Rectangle;
  private dark!: Phaser.GameObjects.Rectangle;
  private glow!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private breathBar!: Phaser.GameObjects.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private animals: Animal[] = [];
  private sheds: Phaser.GameObjects.Image[] = [];
  private hour = START_HOUR;
  private windDir: 1 | -1 = 1;
  private windTimer = 0;
  private spawnTimer = 0;
  private callCooldown = 0;
  private lastCall = -999;
  private crouched = false;
  private inStand = false;
  private aiming = false;
  private glassing = false;
  private breath = BREATH_SECONDS;
  private scentSpray = false;
  private facing: 1 | -1 = 1;
  private movement: Movement = 'still';
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
    this.layers = [];
    this.hour = START_HOUR;
    this.windDir = Math.random() < 0.5 ? 1 : -1;
    this.windTimer = 60 + Math.random() * 60;
    this.spawnTimer = 0;
    this.callCooldown = 0;
    this.lastCall = -999;
    this.crouched = false;
    this.inStand = false;
    this.aiming = false;
    this.glassing = false;
    this.breath = BREATH_SECONDS;
    this.facing = 1;
    this.movement = 'still';
    this.taughtThisHunt = new Set();
    this.ended = false;
    this.lessonsAtStart = this.state.lessons.length;
    this.summary = { areaName: this.area.name, harvested: [], items: {}, meatLbs: 0, fines: 0, newLessons: 0 };
  }

  create(): void {
    createTextures(this);
    this.buildWorld();

    this.player = this.add.image(300, GROUND_Y, has(this.state, 'orange-vest') ? 'hunter-orange' : 'hunter').setOrigin(0.5, 1).setDepth(20);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 60);

    this.buildHud();
    this.bindInput();

    for (let i = 0; i < 6; i++) this.spawnAnimal(Phaser.Math.Between(700, WORLD_W - 100));
    if (this.area.hasSheds) {
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.6) {
          this.sheds.push(this.add.image(Phaser.Math.Between(800, WORLD_W - 200), GROUND_Y + 6, 'shed').setOrigin(0.5, 1).setDepth(15).setAlpha(0.85));
        }
      }
    }
    this.startOfHuntChecks();
  }

  // ---------- Setup ----------

  private buildWorld(): void {
    this.sky = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x1d2a44).setOrigin(0).setScrollFactor(0).setDepth(-10);
    const layer = (key: string, y: number, h: number, factor: number, depth: number, tint?: number) => {
      const t = this.add.tileSprite(0, y, VIEW_W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      if (tint) t.setTint(tint);
      this.layers.push([t, factor]);
    };
    layer('hills', 210, 220, 0.1, -9);
    layer('far-trees', 170, 260, 0.3, -8);
    layer('mid-trees', 92, 340, 0.6, -7);
    layer('ground', GROUND_Y - 30, 140, 1, -6);
    layer('bushes', VIEW_H - 70, 90, 1.25, 40, 0x9fb59a);

    this.scentGfx = this.add.graphics().setDepth(5);
    this.standGfx = this.add.graphics().setDepth(18);
    this.reticle = this.add.graphics().setDepth(60);

    this.glow = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xff8a3a, 0).setOrigin(0).setScrollFactor(0).setDepth(45);
    this.dark = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0a1022, 0).setOrigin(0).setScrollFactor(0).setDepth(46);
  }

  private buildHud(): void {
    const style = { fontFamily: 'monospace', fontSize: '15px', color: '#ece6d6', backgroundColor: '#0009', padding: { x: 8, y: 6 } };
    this.hud = this.add.text(10, 10, '', style).setScrollFactor(0).setDepth(100);
    this.hint = this.add.text(VIEW_W / 2, VIEW_H - 14, '', { ...style, fontSize: '14px' }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
    this.breathBar = this.add.rectangle(VIEW_W / 2 - 60, VIEW_H - 50, 120, 6, 0x8fc46b).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100).setVisible(false);
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
    this.callCooldown = Math.max(0, this.callCooldown - dt);

    this.updatePlayer(dt);
    this.updateAnimals(dt);
    this.updateSpawns(dt);
    this.updateLight();
    this.updateParallax();
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
      this.player.x = Phaser.Math.Clamp(this.player.x + dir * SPEED[this.movement] * dt, 30, WORLD_W - 30);
    }
    this.player.setFlipX(this.facing === -1);
    this.player.setScale(1, this.crouched ? 0.72 : 1);
    this.player.y = this.inStand ? GROUND_Y - 120 : GROUND_Y;
    if (this.movement !== 'still') this.player.y += Math.sin(this.time.now / 70) * 1.5;

    // Holding your breath steadies your aim, but only for a few seconds.
    const holding = this.aiming && k.SPACE.isDown && this.breath > 0;
    this.breath = holding ? this.breath - dt : Math.min(BREATH_SECONDS, this.breath + dt * 0.8);
    this.breathBar.setVisible(this.aiming).setScale(Math.max(0, this.breath / BREATH_SECONDS), 1);
    this.breathBar.setFillStyle(this.breath > 0.5 ? 0x8fc46b : 0xe0675a);
  }

  private updateAnimals(dt: number): void {
    for (const a of [...this.animals]) {
      const s = a.sprite;
      const dx = s.x - this.player.x;
      const distYards = Math.abs(dx) / PX_PER_YARD;

      if (a.mode === 'down') {
        a.icon.setText('');
        a.label.setVisible(false);
        continue;
      }

      if (a.mode === 'flee') {
        s.x += a.dir * a.def.fleeSpeed * dt;
        s.setFlipX(a.dir === -1);
        if (s.x < -100 || s.x > WORLD_W + 100 || distYards > 260) this.removeAnimal(a);
        this.syncAnimalText(a, distYards);
        continue;
      }

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
        if (distYards > 25) s.x += a.dir * a.def.walkSpeed * 1.3 * dt;
        if (a.timer <= 0) a.mode = 'idle';
      } else {
        a.timer -= dt;
        if (a.timer <= 0) {
          a.mode = Math.random() < 0.5 ? 'idle' : 'walk';
          a.timer = 2 + Math.random() * 4;
          if (a.mode === 'walk' && Math.random() < 0.5) a.dir = a.dir === 1 ? -1 : 1;
        }
        if (a.mode === 'walk') {
          s.x += a.dir * a.def.walkSpeed * dt;
          if (s.x < 60 || s.x > WORLD_W - 60) a.dir = a.dir === 1 ? -1 : 1;
        }
      }
      s.setFlipX(a.dir === -1);

      if (distYards < 70 && this.onScreen(s.x) && !this.state.seenAnimals.includes(a.def.id)) {
        this.state.seenAnimals.push(a.def.id);
        note(`📓 New field guide entry: ${a.def.name}.`);
      }
      this.syncAnimalText(a, distYards);
    }
  }

  private syncAnimalText(a: Animal, distYards: number): void {
    const s = a.sprite;
    a.icon.setPosition(s.x, s.y - s.displayHeight - 4);
    a.icon.setText(a.mode === 'flee' ? '!' : a.mode === 'alert' ? '?' : '');
    const far = distYards > CLEAR_SIGHT_YARDS && !this.glassing;
    s.setAlpha(far ? 0.35 : 1);
    a.label.setVisible(this.glassing && a.mode !== 'flee');
    if (this.glassing) {
      const check = checkShot(this.state, a.def, this.state.equippedWeapon, distYards, this.hour);
      a.label.setText(`${a.def.name}\n${Math.round(distYards)} yd · ${check.ok ? 'can shoot' : lesson(check.lesson!).title}`);
      a.label.setPosition(s.x, s.y - s.displayHeight - 22);
    }
  }

  private spook(a: Animal, cause: Sense | null): void {
    if (a.mode === 'flee' || a.mode === 'down') return;
    a.mode = 'flee';
    a.dir = a.sprite.x >= this.player.x ? 1 : -1;
    if (cause && this.onScreen(a.sprite.x)) this.teachOnce(cause);
  }

  private updateSpawns(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 8;
    const alive = this.animals.filter((a) => a.mode !== 'down').length;
    if (alive >= MAX_ANIMALS) return;
    const tod = timeOfDay(this.hour);
    const avgActivity = Object.keys(this.area.spawns).reduce((sum, id) => sum + animalDef(id).activity[tod], 0) / Object.keys(this.area.spawns).length;
    if (Math.random() > avgActivity * 0.7) return;
    // Spawn just out of view so animals walk in rather than pop up.
    const cam = this.cameras.main;
    const side = Math.random() < 0.5 ? cam.scrollX - 120 : cam.scrollX + VIEW_W + 120;
    this.spawnAnimal(Phaser.Math.Clamp(side, 60, WORLD_W - 60));
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
    const sprite = this.add.image(x, GROUND_Y, id).setOrigin(0.5, 1).setDepth(10);
    const icon = this.add.text(x, 0, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffd27a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(30);
    const label = this.add
      .text(x, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff', backgroundColor: '#000a', padding: { x: 4, y: 2 }, align: 'center' })
      .setOrigin(0.5, 1)
      .setDepth(31)
      .setVisible(false);
    this.animals.push({ def, sprite, icon, label, mode: 'idle', dir: Math.random() < 0.5 ? 1 : -1, awareness: 0, timer: Math.random() * 3 });
  }

  private removeAnimal(a: Animal): void {
    a.sprite.destroy();
    a.icon.destroy();
    a.label.destroy();
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

    const distYards = Math.abs(target.sprite.x - this.player.x) / PX_PER_YARD;
    const check = checkShot(this.state, target.def, weaponItem.id, distYards, this.hour);
    if (!check.ok) {
      note('✋ You lower your weapon.');
      return this.teachOnce(check.lesson!, true);
    }

    addItem(this.state, w.ammo, -1);
    this.shotEffects(pt, w.firearm, target);

    const s = target.sprite;
    let col = Math.floor((pt.x - (s.x - s.displayWidth / 2)) / SCALE);
    const row = Math.floor((pt.y - (s.y - s.displayHeight)) / SCALE);
    if (s.flipX) col = s.width / SCALE - 1 - col;
    const result = resolveShot(target.def, w.kind, zoneAt(target.def, col, row));

    if (result.result === 'clean') {
      target.mode = 'down';
      target.quality = result.quality;
      target.weaponId = weaponItem.id;
      this.tweens.add({ targets: s, scaleY: 0.45, duration: 400 });
      s.setAlpha(1).setTint(0xbbbbbb);
    } else {
      target.mode = 'flee';
      target.dir = s.x >= this.player.x ? 1 : -1;
      if (result.result === 'wounded') {
        s.setTint(0xff9999);
        note(`The ${target.def.name.toLowerCase()} was wounded and ran off.`);
      }
    }
    this.teachOnce(result.lesson, true);
  }

  private shotEffects(pt: Phaser.Math.Vector2, firearm: boolean, target?: Animal): void {
    const flash = this.add.circle(this.player.x + this.facing * 26, this.player.y - 38 * this.player.scaleY, firearm ? 8 : 3, 0xfff1a8).setDepth(25);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 120, onComplete: () => flash.destroy() });
    const puff = this.add.circle(pt.x, pt.y, 4, 0xffffff, 0.8).setDepth(26);
    this.tweens.add({ targets: puff, alpha: 0, scale: 3, duration: 300, onComplete: () => puff.destroy() });
    if (firearm) this.cameras.main.shake(120, 0.004);

    // Noise spooks animals nearby: a gunshot carries much farther than a bowstring.
    const range = (firearm ? 160 : 30) * PX_PER_YARD;
    let spooked = false;
    for (const a of this.animals) {
      if (a === target || a.mode === 'down' || a.mode === 'flee') continue;
      if (Math.abs(a.sprite.x - this.player.x) < range) {
        this.spook(a, null);
        spooked = true;
      }
    }
    if (spooked && firearm) this.teachOnce('gunshot');
  }

  private interact(): void {
    const near = (x: number) => Math.abs(x - this.player.x) < 50 && !this.inStand;
    const down = this.animals.find((a) => a.mode === 'down' && near(a.sprite.x));
    if (down) {
      if (down.def.tag && !has(this.state, down.def.tag)) return this.teachOnce('no-tag', true);
      const r = harvest(this.state, down.def, down.quality!, down.weaponId!);
      this.summary.harvested.push(`${down.def.name} (${down.quality})`);
      this.summary.meatLbs += r.meatLbs;
      for (const [id, q] of Object.entries(r.items)) this.summary.items[id] = (this.summary.items[id] ?? 0) + q;
      const got = Object.entries(r.items).map(([id, q]) => `${item(id).name} ×${q}`).join(', ');
      note(`${down.def.tag ? `🏷️ Tagged. ` : ''}Field dressed: ${got || 'no parts'} + ${r.meatLbs} lbs ${down.def.meatName.toLowerCase()}.`);
      for (const l of r.lessons) this.teachOnce(l);
      this.tweens.add({ targets: down.sprite, alpha: 0, duration: 500, onComplete: () => this.removeAnimal(down) });
      return;
    }
    const shed = this.sheds.find((s) => near(s.x));
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
      if (Math.abs(a.sprite.x - this.player.x) / PX_PER_YARD > 220) continue;
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
    const x = this.player.x - this.facing * 18;
    this.standGfx.clear();
    this.standGfx.fillStyle(0x4a3424).fillRect(x - 10, GROUND_Y - 300, 20, 300);
    this.standGfx.fillStyle(0x2b2b2b).fillRect(this.player.x - 22, GROUND_Y - 120, 44, 6);
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
    note(message);
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.onEnd(this.summary));
  }

  // ---------- Drawing ----------

  private onScreen(x: number): boolean {
    const cam = this.cameras.main;
    return x > cam.worldView.x && x < cam.worldView.right;
  }

  private updateParallax(): void {
    const sx = this.cameras.main.scrollX;
    for (const [t, f] of this.layers) t.tilePositionX = (sx * f) % LAYER_W;
  }

  private updateLight(): void {
    const h = this.hour;
    const night = h < 6 ? Phaser.Math.Clamp((6.75 - h) / 1.25, 0, 1) * 0.6 : h > 18.25 ? Phaser.Math.Clamp((h - 18.25) / 1.25, 0, 1) * 0.6 : 0;
    const golden = Math.max(0, 1 - Math.abs(h - 7) / 1.2, 1 - Math.abs(h - 18) / 1.2) * 0.12;
    this.dark.setFillStyle(0x0a1022, night);
    this.glow.setFillStyle(0xff8a3a, golden);
    const day = Phaser.Display.Color.ValueToColor(0x8fc3e0);
    const dusk = Phaser.Display.Color.ValueToColor(0xe9a46a);
    const nightC = Phaser.Display.Color.ValueToColor(0x1d2a44);
    const mid = Phaser.Display.Color.Interpolate.ColorWithColor(day, dusk, 100, golden * 800);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(mid.r, mid.g, mid.b), nightC, 100, (night / 0.6) * 100);
    this.sky.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  }

  /** A faint cone shows where your scent drifts, so you can learn to play the wind. */
  private drawScent(): void {
    const g = this.scentGfx;
    g.clear();
    const len = 160 * PX_PER_YARD * (this.scentSpray ? 0.45 : 1) * (this.inStand ? 0.5 : 1);
    const x = this.player.x;
    const y = this.player.y - 30;
    g.fillStyle(0xd8e6c0, 0.07);
    g.fillTriangle(x, y, x + this.windDir * len, y - 70, x + this.windDir * len, y + 50);
    const t = (this.time.now / 1000) % 1;
    g.fillStyle(0xd8e6c0, 0.25);
    for (let i = 0; i < 6; i++) {
      const f = (i / 6 + t) % 1;
      g.fillCircle(x + this.windDir * len * f, y - 10 + Math.sin(f * 12 + i) * 30 * f, 2);
    }
  }

  private drawReticle(): void {
    const g = this.reticle;
    g.clear();
    if (!this.aiming) return;
    const p = this.reticlePoint();
    g.lineStyle(2, 0xffffff, 0.9).strokeCircle(p.x, p.y, 12);
    g.lineBetween(p.x - 18, p.y, p.x - 5, p.y).lineBetween(p.x + 5, p.y, p.x + 18, p.y);
    g.lineBetween(p.x, p.y - 18, p.x, p.y - 5).lineBetween(p.x, p.y + 5, p.x, p.y + 18);
    g.fillStyle(0xff3b30, 1).fillCircle(p.x, p.y, 1.5);
  }

  private updateHud(): void {
    const w = this.weapon();
    const ammo = w?.weapon ? count(this.state, w.weapon.ammo) : 0;
    const tags = ['deer-tag', 'turkey-tag'].filter((t) => has(this.state, t)).map((t) => `${item(t).name.replace(' Tag', '')} ×${count(this.state, t)}`);
    this.hud.setText([
      `${formatHour(this.hour)}  ${isLegalLight(this.hour) ? '✓ legal light' : '✗ no shooting'}`,
      `Wind ${this.windDir === 1 ? '→ →' : '← ←'}  scent drifts ${this.windDir === 1 ? 'right' : 'left'}`,
      `${w ? `${w.name}: ${ammo}` : 'No weapon'}${tags.length ? `  Tags: ${tags.join(', ')}` : ''}`,
      `${this.inStand ? 'In tree stand' : this.crouched ? 'Crouched' : 'Standing'} · ${this.movement}${this.glassing ? ' · 🔭 glassing' : ''}`,
    ]);

    const near = (x: number) => Math.abs(x - this.player.x) < 50 && !this.inStand;
    let hint = this.aiming
      ? 'Left-click: shoot · hold Space: hold breath · F / right-click: lower'
      : 'A/D move · Shift run · S crouch · F aim · B glass · C call · T stand · Esc camp';
    if (this.animals.some((a) => a.mode === 'down' && near(a.sprite.x))) hint = 'Press E to tag and field dress';
    else if (this.sheds.some((s) => near(s.x))) hint = 'A shed antler! Press E to pick it up';
    this.hint.setText(hint);
  }
}
