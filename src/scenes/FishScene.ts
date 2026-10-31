import Phaser from 'phaser';
import { Backdrop } from '../art/backdrop';
import { setupCameras, type SceneCameras } from '../art/cameras';
import { createSprites, frameKey, HAND, spriteImage } from '../art/sprites';
import { GROUND_Y, LAKE_HORIZON, VIEW_W } from '../art/view';
import {
  cannotFish,
  cannotKeep,
  castQuality,
  flyType,
  hatchAt,
  newFight,
  running,
  stepFight,
  strikeRate,
  TENSION_HIGH,
  TENSION_LOW,
  troutLbs,
  type FightState,
} from '../core/fishing';
import { formatHour } from '../core/hunting';
import { addItem, count, has } from '../core/state';
import type { FishCatch, FishDef, GameState } from '../core/types';
import { FLIES, fish as fishDef } from '../data/fish';
import { item } from '../data/items';
import { note, teach } from '../ui/cards';
import { clearHud, setHud } from '../ui/hud';
import { hideTouch, isTouch, pad, setTouchState, showTouch } from '../ui/touch';

const WORLD_W = 1400;
const START_HOUR = 5.8;
const END_HOUR = 19.5;
const DAY_SECONDS = 300;
const HOURS_PER_SEC = (END_HOUR - START_HOUR) / DAY_SECONDS;
/** The river flows to the right, carrying the fly with it (pixels per second). */
const CURRENT = 9;
/** How far you can cast from the bank, in pixels. Waders let you reach farther. */
const CAST_RANGE = 120;
const WADER_REACH = 40;
/** Fish swim between these heights (the bottom of their shadow). */
const FISH_TOP = LAKE_HORIZON + 20;
const FISH_BOTTOM = GROUND_Y - 8;
/** One false-cast rhythm, in seconds. Release when the loop straightens. */
const LOOP_SECONDS = 1.1;
const STRIKE_WINDOW = 1.2;
/** A press during a drift must be held this long to recast, so a stray tap doesn't lose the drift. */
const RECAST_HOLD_MS = 220;
/** Trout this close to the fly swim over to look at it. */
const CURIOUS_RANGE = 110;
/** More bites on the relaxed river than the raw rule rates. */
const BITE_BOOST = 1.6;
const NO_NET_SLIP = 0.25;
const TOUCH_ZOOM = 1.35;
const FLY_ORDER = ['fly-adams', 'fly-caddis', 'fly-nymph', 'fly-streamer'];

export interface FishSummary {
  catches: FishCatch[];
  repGained: number;
  meatLbs: number;
  newLessons: number;
}

export interface FishData {
  state: GameState;
  onEnd(summary: FishSummary): void;
}

interface Trout {
  def: FishDef;
  x: number;
  y: number;
  homeX: number;
  dir: 1 | -1;
  /** Seconds left before a spooked fish calms down. */
  spooked: number;
  nextRise: number;
  shadow: Phaser.GameObjects.Ellipse;
}

type Phase = 'idle' | 'loading' | 'flying' | 'drifting' | 'strike' | 'fighting' | 'card';

export class FishScene extends Phaser.Scene {
  private state!: GameState;
  private onEnd!: (s: FishSummary) => void;
  private backdrop!: Backdrop;
  private angler!: Phaser.GameObjects.Image;
  private gfx!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cams!: SceneCameras;
  private viewLeft = 0;

  private trout: Trout[] = [];
  private rings: { x: number; y: number; age: number }[] = [];
  private bugs: Phaser.GameObjects.Rectangle[] = [];
  private hour = START_HOUR;
  private phase: Phase = 'idle';
  private facing: 1 | -1 = 1;
  private crouched = false;
  private walkAnim = 0;
  private fly: string | null = null;
  private target = new Phaser.Math.Vector2();
  private loadTime = 0;
  private flyPos = new Phaser.Math.Vector2();
  private flyFrom = new Phaser.Math.Vector2();
  private phaseTime = 0;
  private quality = 1;
  private hooked: Trout | null = null;
  private fight: FightState = newFight();
  private hookAt = new Phaser.Math.Vector2();
  private reeling = false;
  private jumpTimer = 0;
  private castsWithoutStrike = 0;
  /** When a press started during a drift (0 when none). */
  private recastAt = 0;
  private driftFromX = 0;
  private lastHatch: string | null = null;
  private taught = new Set<string>();
  private ended = false;
  private summary!: FishSummary;
  private lessonsAtStart = 0;
  private keptToday = 0;

  constructor() {
    super('fish');
  }

  init(data: FishData): void {
    this.state = data.state;
    this.onEnd = data.onEnd;
    this.trout = [];
    this.rings = [];
    this.bugs = [];
    this.hour = START_HOUR;
    this.phase = 'idle';
    this.facing = 1;
    this.crouched = false;
    this.hooked = null;
    this.reeling = false;
    this.castsWithoutStrike = 0;
    this.lastHatch = null;
    this.taught = new Set();
    this.ended = false;
    this.lessonsAtStart = this.state.lessons.length;
    this.keptToday = 0;
    this.summary = { catches: [], repGained: 0, meatLbs: 0, newLessons: 0 };
    this.fly = FLY_ORDER.find((f) => has(this.state, f)) ?? null;
    this.jumpSprite = null;
  }

  create(): void {
    createSprites(this);
    this.backdrop = new Backdrop(this, { scrolling: true, lake: true });
    this.cams = setupCameras(this, this.backdrop, { touchZoom: isTouch() ? TOUCH_ZOOM : undefined });
    this.viewLeft = 0;
    this.gfx = this.add.graphics().setDepth(22);
    this.angler = spriteImage(this, 160, GROUND_Y, frameKey('angler', 'idle')).setOrigin(0.5, 1).setDepth(20);

    for (let i = 0; i < 8; i++) this.spawnTrout(140 + i * 160 + Math.random() * 80);
    for (let i = 0; i < 16; i++) {
      this.bugs.push(this.add.rectangle(0, 0, 1, 2, 0xf6f0c8).setDepth(30).setVisible(false));
    }

    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearHud();
      hideTouch();
    });
    if (isTouch()) {
      showTouch(
        {
          flybox: () => this.nextFly(),
          crouch: () => (this.crouched = !this.crouched),
          act: () => {},
          glass: () => {},
          call: () => {},
          stand: () => {},
          swap: () => {},
          camp: () => this.endDay('You head back to camp.'),
        },
        { flybox: true, glass: false, call: false, stand: false, swap: false },
      );
    }

    this.teachOnce('read-water', false);
    const missing = cannotFish(this.state, this.fly);
    if (missing) this.teachOnce(missing, true);
    else note(`Aspen Creek. Tied on: ${item(this.fly!).name.replace(/ \(.*\)/, '')}.`);
  }

  private spawnTrout(x: number): void {
    const roll = Math.random();
    const def = fishDef(roll < 0.5 ? 'rainbow' : roll < 0.8 ? 'brown' : 'brook');
    const y = FISH_TOP + Math.random() * (FISH_BOTTOM - FISH_TOP);
    const shadow = this.add.ellipse(x, y, 16, 4, 0x0e1a1a, 0).setDepth(8);
    this.trout.push({ def, x, y, homeX: x, dir: Math.random() < 0.5 ? 1 : -1, spooked: 0, nextRise: 3 + Math.random() * 8, shadow });
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('A,D,LEFT,RIGHT,SHIFT,SPACE,S,Q,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-S', () => (this.crouched = !this.crouched));
    kb.on('keydown-Q', () => this.nextFly());
    kb.on('keydown-ESC', () => this.endDay('You head back to camp.'));
    kb.on('keydown-SPACE', () => this.press(null));
    kb.on('keyup-SPACE', () => this.release());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.press(p));
    this.input.on('pointerup', () => this.release());
    this.input.on('pointerupoutside', () => this.release());
  }

  // ---------- Controls ----------

  /** Touch, click or Space: start a cast, set the hook, or reel, depending on the moment. */
  private press(p: Phaser.Input.Pointer | null): void {
    if (this.ended || this.phase === 'card') return;
    if (this.phase === 'strike') return this.setHook();
    if (this.phase === 'fighting') {
      this.reeling = true;
      return;
    }
    if (this.phase === 'drifting') {
      // Only a deliberate hold recasts; see updateLine.
      this.recastAt = this.time.now;
      return;
    }
    if (this.phase === 'idle') {
      const missing = cannotFish(this.state, this.fly);
      if (missing) return this.teachOnce(missing, true);
      const world = p ? this.cams.world.getWorldPoint(p.x, p.y) : new Phaser.Math.Vector2(this.angler.x + this.facing * 80, LAKE_HORIZON + 30);
      this.phase = 'loading';
      this.loadTime = 0;
      this.aimAt(world.x, world.y);
    }
  }

  private release(): void {
    this.recastAt = 0;
    if (this.phase === 'fighting') this.reeling = false;
    if (this.phase === 'loading') this.cast();
  }

  /** Keep the target on the water and within casting range. */
  private aimAt(x: number, y: number): void {
    const reach = CAST_RANGE + (has(this.state, 'waders') ? WADER_REACH : 0);
    const tx = Phaser.Math.Clamp(x, this.angler.x - reach, this.angler.x + reach);
    const ty = Phaser.Math.Clamp(y, LAKE_HORIZON + 8, GROUND_Y - 6);
    this.target.set(tx, ty);
    this.facing = tx >= this.angler.x ? 1 : -1;
  }

  private nextFly(): void {
    const owned = FLY_ORDER.filter((f) => has(this.state, f));
    if (!owned.length) return this.teachOnce('no-flies', true);
    const i = this.fly ? owned.indexOf(this.fly) : -1;
    this.fly = owned[(i + 1) % owned.length];
    if (this.phase === 'drifting') this.phase = 'idle';
    note(`Tied on: ${item(this.fly).name.replace(/ \(.*\)/, '')} (${count(this.state, this.fly)} left).`);
  }

  private loopPhase(): number {
    return (this.loadTime / LOOP_SECONDS) % 1;
  }

  private cast(): void {
    // The loop is straightest halfway through each stroke.
    const error = Math.abs(this.loopPhase() - 0.5);
    this.quality = castQuality(error);
    const miss = (1 - this.quality) * 30;
    this.flyFrom.copy(this.rodTip());
    this.flyPos.set(this.target.x + (Math.random() - 0.5) * miss, this.target.y + (Math.random() - 0.5) * miss * 0.4);
    this.flyPos.y = Phaser.Math.Clamp(this.flyPos.y, LAKE_HORIZON + 8, GROUND_Y - 6);
    this.phase = 'flying';
    this.phaseTime = 0;
  }

  private landFly(): void {
    this.phase = 'drifting';
    this.phaseTime = 0;
    this.driftFromX = this.flyPos.x;
    this.castsWithoutStrike++;
    this.addRing(this.flyPos.x, this.flyPos.y);
    if (this.quality < 0.25) {
      // A splashy cast scares every trout nearby.
      for (const t of this.trout) if (Math.abs(t.x - this.flyPos.x) < 50) t.spooked = 12;
      this.teachOnce('splashy-cast', true);
    }
    if (this.fly && FLIES[this.fly] === 'nymph' && Math.random() < 0.05) {
      addItem(this.state, this.fly, -1);
      this.phase = 'idle';
      this.teachOnce('snag', true);
      if (!has(this.state, this.fly)) this.fly = FLY_ORDER.find((f) => has(this.state, f)) ?? null;
      return;
    }
    const hatch = hatchAt(this.hour);
    if (this.castsWithoutStrike >= 3 && this.fly) {
      const type = flyType(this.fly);
      if (hatch && type !== hatch) this.teachOnce('match-hatch', false);
      else if (!hatch && (type === 'mayfly' || type === 'caddis')) this.teachOnce('subsurface', false);
    }
  }

  private setHook(): void {
    if (!this.hooked) return;
    this.phase = 'fighting';
    this.fight = newFight();
    this.hookAt.copy(this.flyPos);
    this.jumpTimer = 0.4;
    this.castsWithoutStrike = 0;
    note(`Fish on! A ${this.hooked.def.name.toLowerCase()}.`);
  }

  // ---------- Main loop ----------

  update(_t: number, deltaMs: number): void {
    if (this.ended) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.hour += dt * HOURS_PER_SEC;
    if (this.hour >= END_HOUR) return this.endDay('Darkness falls on the creek. Time to head back.');

    this.updateHatch();
    this.updateAngler(dt);
    this.updateTrout(dt);
    this.updateLine(dt);
    this.viewLeft = this.cams.follow(this.angler.x, WORLD_W);
    this.backdrop.update(this.hour, this.viewLeft, dt, 1);
    this.angler.setTint(this.backdrop.light);
    this.draw();
    this.updateHud();
  }

  private updateHatch(): void {
    const hatch = hatchAt(this.hour);
    if (hatch !== this.lastHatch) {
      if (hatch) note(hatch === 'mayfly' ? 'Small gray mayflies are hatching. Trout start rising!' : 'Caddisflies are fluttering over the water. Trout are rising.');
      else if (this.lastHatch) note('The hatch is over. The rises stop.');
      this.lastHatch = hatch;
    }
  }

  private updateAngler(dt: number): void {
    const k = this.keys;
    const canWalk = this.phase === 'idle' || this.phase === 'drifting';
    const left = k.A.isDown || k.LEFT.isDown || pad.left;
    const right = k.D.isDown || k.RIGHT.isDown || pad.right;
    let dir = 0;
    if (canWalk && left !== right) dir = left ? -1 : 1;
    const speed = this.crouched ? 20 : k.SHIFT.isDown || pad.run ? 80 : 40;
    if (dir) {
      this.facing = dir as 1 | -1;
      this.angler.x = Phaser.Math.Clamp(this.angler.x + dir * speed * dt, 20, WORLD_W - 20);
      if (this.phase === 'drifting') this.phase = 'idle';
      // Walking the bank upright spooks fish holding close to it.
      if (!this.crouched) for (const t of this.trout) if (Math.abs(t.x - this.angler.x) < 30 && t.y > GROUND_Y - 24) t.spooked = Math.max(t.spooked, 6);
    }
    this.walkAnim += dt * 7;
    const frame = this.crouched ? 'crouch' : dir ? ['walk1', 'idle', 'walk2', 'idle'][Math.floor(this.walkAnim) % 4] : 'idle';
    this.angler.setTexture(frameKey('angler', frame)).setFlipX(this.facing === -1);
    if (isTouch()) setTouchState(this.phase === 'loading' || this.phase === 'fighting', false);
  }

  private updateTrout(dt: number): void {
    const hatch = hatchAt(this.hour);
    for (const t of this.trout) {
      if (t === this.hooked && (this.phase === 'fighting' || this.phase === 'card')) {
        t.shadow.setAlpha(0);
        continue;
      }
      t.spooked = Math.max(0, t.spooked - dt);
      // Hold near home, nosing into the current; dart away when spooked.
      const goal = t.spooked > 0 ? t.homeX + (t.x < this.angler.x ? -70 : 70) : t.homeX + Math.sin(this.time.now / 2000 + t.homeX) * 20;
      t.x += Phaser.Math.Clamp(goal - t.x, -1, 1) * (t.spooked > 0 ? 60 : 8) * dt;
      t.dir = goal >= t.x ? 1 : -1;
      // Rises give fish away during a hatch.
      t.nextRise -= dt;
      if (hatch && t.spooked === 0 && t.nextRise <= 0) {
        this.addRing(t.x, t.y - 2);
        t.nextRise = 5 + Math.random() * 8;
      }
      // Shadows show only up close, the way you'd spot fish from the bank.
      const near = Math.abs(t.x - this.angler.x) < 100;
      t.shadow.setPosition(Math.round(t.x), Math.round(t.y)).setFillStyle(0x0e1a1a, near ? 0.28 : 0);
    }
  }

  private updateLine(dt: number): void {
    this.phaseTime += dt;
    if (this.phase === 'loading') {
      this.loadTime += dt;
      const p = this.input.activePointer;
      if (p.isDown) {
        const w = this.cams.world.getWorldPoint(p.x, p.y);
        this.aimAt(w.x, w.y);
      }
    } else if (this.phase === 'flying') {
      if (this.phaseTime >= 0.35) this.landFly();
    } else if (this.phase === 'drifting') {
      // Holding down during a drift recasts, once it's clearly a hold and not a tap.
      const p = this.input.activePointer;
      if (this.recastAt && (p.isDown || this.keys.SPACE.isDown) && this.time.now - this.recastAt > RECAST_HOLD_MS) {
        this.recastAt = 0;
        const w = p.isDown ? this.cams.world.getWorldPoint(p.x, p.y) : new Phaser.Math.Vector2(this.angler.x + this.facing * 80, LAKE_HORIZON + 30);
        this.phase = 'loading';
        this.loadTime = 0;
        this.aimAt(w.x, w.y);
        return;
      }
      // The fly drifts downstream, slowing as the line tightens and swings it toward the bank.
      // It stays out until you recast or it swings all the way in.
      const drifted = this.flyPos.x - this.driftFromX;
      this.flyPos.x += CURRENT * Math.max(0.15, 1 - drifted / 100) * dt;
      this.flyPos.y = Math.min(GROUND_Y - 8, this.flyPos.y + 1.5 * dt);
      const reach = CAST_RANGE + (has(this.state, 'waders') ? WADER_REACH : 0);
      if (Math.abs(this.flyPos.x - this.angler.x) > reach + 30) {
        this.phase = 'idle';
        note('Your fly swung out of reach. Cast again.');
      }
      if (this.fly) {
        const type = flyType(this.fly);
        for (const t of this.trout) {
          if (t.spooked > 0) continue;
          // Curious trout swim over to inspect the fly.
          const dx = this.flyPos.x - t.x;
          if (Math.abs(dx) < CURIOUS_RANGE) {
            t.homeX += Math.sign(dx) * Math.min(Math.abs(dx), 14 * dt);
            t.y += Phaser.Math.Clamp(this.flyPos.y - t.y, -6 * dt, 6 * dt);
          }
          if (Math.abs(dx) > 26 || Math.abs(t.y - this.flyPos.y) > 18) continue;
          if (Math.random() < strikeRate(t.def, type, this.hour, this.quality) * BITE_BOOST * dt) {
            this.hooked = t;
            this.phase = 'strike';
            this.phaseTime = 0;
            this.addRing(this.flyPos.x, this.flyPos.y);
            this.addRing(this.flyPos.x, this.flyPos.y);
            break;
          }
        }
      }
    } else if (this.phase === 'strike') {
      if (this.phaseTime > STRIKE_WINDOW) {
        // Missed it, but the fly is still out there and the trout may come back.
        if (this.hooked) this.hooked.spooked = 4;
        this.hooked = null;
        this.phase = 'drifting';
        this.teachOnce('set-hook', true);
      }
    } else if (this.phase === 'fighting' && this.hooked) {
      const strength = 0.6 + (this.hooked.def.maxIn / 24) * 0.6;
      // Reeling is simply "a finger, the mouse or Space is held down" right now, including
      // the same touch that set the hook.
      const holding = this.reeling || this.keys.SPACE.isDown || this.input.activePointer.isDown;
      const result = stepFight(this.fight, holding, strength, dt);
      // The fish comes toward the bank as you gain line.
      const f = this.fight.progress / 100;
      this.hooked.x = Phaser.Math.Linear(this.hookAt.x, this.angler.x + this.facing * 14, f) + Math.sin(this.time.now / 300) * 6 * (1 - f);
      this.hooked.y = Phaser.Math.Linear(this.hookAt.y, GROUND_Y - 6, f);
      this.jumpTimer -= dt;
      if (running(this.fight, strength) && this.jumpTimer <= 0) this.jumpTimer = 1.6;
      if (result === 'snapped') this.loseFish('tippet', true);
      else if (result === 'thrown') this.loseFish('slack', false);
      else if (result === 'landed') {
        if (!has(this.state, 'landing-net') && Math.random() < NO_NET_SLIP) this.loseFish('net', false);
        else this.showCatch();
      }
    }
    // Bugs over the water during a hatch.
    const hatch = hatchAt(this.hour);
    this.bugs.forEach((b, i) => {
      b.setVisible(!!hatch);
      if (!hatch) return;
      const x = this.viewLeft + ((i * 53 + this.time.now / 40) % VIEW_W);
      const y = LAKE_HORIZON + 30 - ((this.time.now / 25 + i * 37) % 60) + Math.sin(this.time.now / 200 + i) * 3;
      b.setPosition(Math.round(x), Math.round(y)).setFillStyle(hatch === 'mayfly' ? 0xd8d8c8 : 0xc8a870);
    });
    this.rings = this.rings.filter((r) => (r.age += dt) < 1.6);
  }

  private loseFish(lesson: string, loseFly: boolean): void {
    if (loseFly && this.fly) {
      addItem(this.state, this.fly, -1);
      if (!has(this.state, this.fly)) this.fly = FLY_ORDER.find((f) => has(this.state, f)) ?? null;
    }
    if (this.hooked) {
      this.hooked.spooked = 15;
      this.hooked.x = this.hookAt.x;
      this.hooked.y = this.hookAt.y;
    }
    this.hooked = null;
    this.reeling = false;
    this.phase = 'idle';
    this.teachOnce(lesson, true);
  }

  // ---------- Catch card ----------

  private showCatch(): void {
    const t = this.hooked!;
    this.phase = 'card';
    this.reeling = false;
    const lengthIn = Math.round(t.def.minIn + Math.pow(Math.random(), 1.6) * (t.def.maxIn - t.def.minIn));
    const keepBlock = cannotKeep(t.def, lengthIn, this.keptToday);
    const art = this.textures.get(frameKey(`trout-${t.def.id}`, 'swim')).getSourceImage() as HTMLCanvasElement;
    const flyName = item(this.fly!).name.replace(/ \(.*\)/, '');
    const firstOfKind = !this.state.seenAnimals.includes(t.def.id);
    if (firstOfKind) this.state.seenAnimals.push(t.def.id);

    const card = document.createElement('div');
    card.className = 'catch-card pix';
    card.innerHTML = `
      <h2>${t.def.name}${firstOfKind ? ' · first one!' : ''}</h2>
      <div class="fish-frame"><img class="fish-art" src="${art.toDataURL()}" alt="${t.def.name}"></div>
      <div class="stats">${lengthIn} in · about ${troutLbs(lengthIn)} lb · on a ${flyName}</div>
      <ul class="facts">
        <li>Keep only ${t.def.keepMinIn} in or longer · ${2 - this.keptToday} more trout may be kept today</li>
        <li>${t.def.fieldGuide[0]}</li>
      </ul>
      <div class="dbtns">
        <button class="primary" data-release>Release</button>
        <button data-keep ${keepBlock ? 'disabled' : ''}>Keep</button>
      </div>
      ${keepBlock ? `<p class="reason">${keepBlock === 'keep-size' ? `Under ${t.def.keepMinIn} inches: it has to go back.` : 'You have kept your limit today.'}</p>` : ''}`;
    document.getElementById('ui')!.append(card);
    if (keepBlock) this.teachOnce(keepBlock, false);

    const done = (released: boolean) => {
      card.remove();
      const c: FishCatch = { day: this.state.day, fish: t.def.id, lengthIn, fly: this.fly!, released };
      (this.state.fishLog ??= []).push(c);
      this.summary.catches.push(c);
      if (released) {
        this.state.reputation += 1;
        this.summary.repGained += 1;
        this.teachOnce('release', false);
        note(`The ${t.def.name.toLowerCase()} swims off. Reputation +1.`);
      } else {
        const lbs = Math.max(1, Math.round(troutLbs(lengthIn)));
        this.state.freezer.Trout = (this.state.freezer.Trout ?? 0) + lbs;
        this.summary.meatLbs += lbs;
        this.keptToday++;
        note(`Into the creel: ${lengthIn} in ${t.def.name.toLowerCase()}.`);
      }
      // The fish leaves this stretch; a new one moves in somewhere else.
      t.shadow.destroy();
      this.trout = this.trout.filter((x) => x !== t);
      this.spawnTrout(Math.random() * WORLD_W);
      this.hooked = null;
      this.phase = 'idle';
    };
    card.querySelector('[data-release]')!.addEventListener('click', () => done(true));
    card.querySelector('[data-keep]')!.addEventListener('click', () => done(false));
  }

  // ---------- Drawing ----------

  private hand(): Phaser.Math.Vector2 {
    const s = this.angler;
    const col = this.facing === 1 ? HAND.x : s.displayWidth - 1 - HAND.x;
    return new Phaser.Math.Vector2(s.x - s.displayWidth / 2 + col, s.y - s.displayHeight + HAND.y);
  }

  private rodTip(): Phaser.Math.Vector2 {
    const h = this.hand();
    let angle = -0.9;
    if (this.phase === 'loading') angle = -0.9 - Math.sin(this.loopPhase() * Math.PI * 2) * 0.9;
    if (this.phase === 'fighting') angle = -1.2;
    return new Phaser.Math.Vector2(h.x + Math.cos(angle) * 34 * this.facing, h.y + Math.sin(angle) * 34);
  }

  private addRing(x: number, y: number): void {
    this.rings.push({ x, y, age: 0 });
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const hand = this.hand();
    const tip = this.rodTip();
    const light = this.backdrop.light;

    // Rise rings and splashes.
    for (const r of this.rings) {
      const rad = 2 + r.age * 9;
      g.lineStyle(1, 0xffffff, 0.6 * (1 - r.age / 1.6));
      g.strokeEllipse(r.x, r.y, rad * 2, rad * 0.7);
    }

    // The rod: bent toward the fish while fighting.
    g.lineStyle(1, Phaser.Display.Color.ValueToColor(0x3a2a1a).color, 1);
    if (this.phase === 'fighting' && this.hooked) {
      const bend = new Phaser.Math.Vector2(tip.x + this.facing * 6, tip.y + 10);
      new Phaser.Curves.QuadraticBezier(hand, tip, bend).draw(g, 12);
      this.drawLine(bend, new Phaser.Math.Vector2(this.hooked.x, this.hooked.y - 3), 0, light);
      // Jumps: the trout clears the water now and then.
      const jumping = this.jumpTimer > 0.8;
      const key = frameKey(`trout-${this.hooked.def.id}`, 'swim');
      this.hookedSprite(key, jumping);
    } else {
      g.lineBetween(hand.x, hand.y, tip.x, tip.y);
      this.hookedSprite(null, false);
    }

    if (this.phase === 'loading') {
      // False casting: the line loops back and forth over your head.
      const swing = Math.cos(this.loopPhase() * Math.PI * 2);
      const end = new Phaser.Math.Vector2(tip.x - this.facing * swing * 46, tip.y - 8 + Math.abs(swing) * 4);
      this.drawLine(tip, end, -6, light);
      // Timing ring: release when it closes on the target.
      const r = 3 + Math.abs(this.loopPhase() - 0.5) * 34;
      g.lineStyle(1, 0xffffff, 0.9).strokeCircle(this.target.x, this.target.y, r);
      g.fillStyle(0xf2a65a, 1).fillRect(this.target.x - 1, this.target.y - 1, 3, 3);
    } else if (this.phase === 'flying') {
      const f = Math.min(1, this.phaseTime / 0.35);
      const now = new Phaser.Math.Vector2(Phaser.Math.Linear(tip.x, this.flyPos.x, f), Phaser.Math.Linear(tip.y - 10, this.flyPos.y, f * f));
      this.drawLine(tip, now, -10 * (1 - f), light);
    } else if (this.phase === 'drifting' || this.phase === 'strike') {
      this.drawLine(tip, this.flyPos, 10, light);
      const type = this.fly ? FLIES[this.fly] : 'mayfly';
      // Dry flies float; sunk flies show an orange strike indicator.
      if (type === 'nymph' || type === 'streamer') g.fillStyle(0xff7a1a, 1).fillRect(this.flyPos.x - 1, this.flyPos.y - 2, 3, 3);
      else {
        g.fillStyle(0xf4f0e0, 1).fillRect(this.flyPos.x, this.flyPos.y - 3, 1, 2);
        g.fillStyle(0x6a5a4a, 1).fillRect(this.flyPos.x - 1, this.flyPos.y - 1, 3, 1);
      }
      if (this.phase === 'strike') g.fillStyle(0xffffff, 0.9).fillRect(this.flyPos.x - 4, this.flyPos.y - 6, 9, 2);
    }
  }

  private jumpSprite: Phaser.GameObjects.Image | null = null;

  private hookedSprite(key: string | null, jumping: boolean): void {
    if (!key || !this.hooked) {
      this.jumpSprite?.setVisible(false);
      return;
    }
    this.jumpSprite ??= spriteImage(this, 0, 0, key).setDepth(21);
    const t = this.hooked;
    this.jumpSprite.setTexture(key).setVisible(true).setFlipX(t.x < this.angler.x);
    this.jumpSprite.setPosition(Math.round(t.x), Math.round(t.y - (jumping ? 14 : 2))).setAngle(jumping ? (t.x < this.angler.x ? 20 : -20) : 0);
    this.jumpSprite.setAlpha(jumping ? 1 : 0.55).setTint(this.backdrop.light);
  }

  /** Fly line: a pale curve that sags (positive) or arcs up (negative) between two points. */
  private drawLine(a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, sag: number, light: number): void {
    const mid = new Phaser.Math.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2 + sag);
    const c = Phaser.Display.Color.IntegerToColor(light);
    const color = Phaser.Display.Color.GetColor((240 * c.red) / 255, (214 * c.green) / 255, (120 * c.blue) / 255);
    this.gfx.lineStyle(1, color, 1);
    new Phaser.Curves.QuadraticBezier(a, mid, b).draw(this.gfx, 16);
  }

  private updateHud(): void {
    const hatch = hatchAt(this.hour);
    const flyName = this.fly ? `${item(this.fly).name.replace(/ \(.*\)/, '')} ×${count(this.state, this.fly)}` : 'No flies';
    const touch = isTouch();
    const hints: Record<Phase, string> = {
      idle: touch ? 'Touch and hold the water where you want your fly' : 'Hold the mouse on the water where you want your fly',
      loading: 'Let go when the ring closes on the target',
      flying: '',
      drifting: touch ? 'Let it drift. A trout will come look… hold to recast' : 'Let it drift. A trout will come look… hold to recast',
      strike: touch ? 'A take! Tap now!' : 'A take! Click or press Space!',
      fighting: this.hooked && running(this.fight, 0.6 + (this.hooked.def.maxIn / 24) * 0.6) ? "It's running! Let go and let it take line" : touch ? 'Hold anywhere to reel it in' : 'Hold the mouse or Space to reel it in',
      card: '',
    };
    setHud({
      time: '',
      legal: true,
      wind: 1,
      weapon: '',
      tags: '',
      stance: '',
      breath: null,
      hint: hints[this.phase],
      lines: [
        `<b>${formatHour(this.hour)}</b> <span class="muted">· ${hatch ? `<span class="right">${hatch === 'mayfly' ? 'mayfly' : 'caddis'} hatch</span>` : 'no hatch'}</span>`,
        `${flyName} · ${this.keptToday}/2 kept${this.crouched ? ' · crouched' : ''}`,
      ],
      fight: this.phase === 'fighting' ? { tension: this.fight.tension, progress: this.fight.progress, low: TENSION_LOW, high: TENSION_HIGH } : undefined,
    });
  }

  private teachOnce(id: string, force: boolean): void {
    if (!force && this.taught.has(id) && this.state.lessons.includes(id)) return;
    if (!force && this.state.lessons.includes(id)) return;
    this.taught.add(id);
    teach(this.state, id);
  }

  private endDay(message: string): void {
    if (this.ended || this.phase === 'card') return;
    this.ended = true;
    this.summary.newLessons = this.state.lessons.length - this.lessonsAtStart;
    clearHud();
    note(message);
    this.cams.fadeOut(600, () => this.onEnd(this.summary));
  }
}
