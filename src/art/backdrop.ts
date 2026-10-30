import Phaser from 'phaser';
import { golden, gradeAt, lerpColor, nightness, type Grade } from './palette';
import { GROUND_Y, VIEW_H, VIEW_W } from './view';

type Ctx = CanvasRenderingContext2D;

/** Deterministic random numbers, so scenery is the same every time. */
function rng(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Draws at x, x - W and x + W so the layer tiles seamlessly. */
function wrapped(draw: (dx: number) => void): void {
  for (const dx of [-VIEW_W, 0, VIEW_W]) draw(dx);
}

/** Periodic noise built from sines whose periods divide the layer width, so it tiles. */
function ridgeNoise(rand: () => number, octaves: [number, number][]): (x: number) => number {
  const phases = octaves.map(() => rand() * Math.PI * 2);
  return (x) => octaves.reduce((sum, [cycles, amp], i) => sum + Math.sin((x / VIEW_W) * Math.PI * 2 * cycles + phases[i]) * amp, 0);
}

function pine(ctx: Ctx, cx: number, base: number, h: number, maxHalf: number, color: string, shade: string, rand: () => number): void {
  const top = base - h;
  const tiers = Math.max(3, Math.round(h / 14));
  for (let y = top; y < base; y++) {
    const t = (y - top) / h;
    const f = (t * tiers) % 1;
    const half = Math.max(0.5, maxHalf * (0.2 + 0.8 * t) * (0.5 + 0.5 * f) + (rand() < 0.25 ? 1 : 0));
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    rect(ctx, x0, y, x1 - x0 + 1, 1, color);
    if (shade !== color && x1 - cx > 1) rect(ctx, cx + 1, y, x1 - cx, 1, shade);
  }
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

// ---------- Far layers: grayscale, tinted by the time-of-day grade ----------

function mountains(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 120);
  const rand = rng(11);
  const back = ridgeNoise(rand, [[2, 18], [5, 9], [11, 4], [23, 2]]);
  for (let x = 0; x < VIEW_W; x++) {
    const y = Math.round(40 + back(x));
    const slope = back(x + 1) - back(x);
    rect(ctx, x, y, 1, 120 - y, '#ffffff');
    // Shade the slopes facing away from the light.
    if (slope > 0) rect(ctx, x, y, 1, 3 + Math.round(slope * 6), '#e2e2e2');
  }
  return c;
}

function ridge(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 90);
  const rand = rng(12);
  const hill = ridgeNoise(rand, [[3, 10], [7, 5], [13, 2]]);
  for (let x = 0; x < VIEW_W; x++) rect(ctx, x, Math.round(46 + hill(x)), 1, 90, '#ffffff');
  for (let i = 0; i < 90; i++) {
    const x = rand() * VIEW_W;
    const base = Math.round(48 + hill(x));
    const h = 6 + rand() * 10;
    wrapped((dx) => pine(ctx, Math.round(x + dx), base, h, 2 + rand() * 2, '#ffffff', '#ffffff', rand));
  }
  return c;
}

function forest(height: number, seed: number, count: number, minH: number, maxH: number, halfMul: number, shade: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, height);
  const rand = rng(seed);
  rect(ctx, 0, height - 18, VIEW_W, 18, '#ffffff');
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * VIEW_W);
    const h = minH + rand() * (maxH - minH);
    const half = h * halfMul * (0.8 + rand() * 0.4);
    wrapped((dx) => pine(ctx, x + dx, height - 10, h, half, '#ffffff', shade, rng(seed + i)));
  }
  return c;
}

// ---------- Near layers: full color, multiplied by the light ----------

const LEAF_COLORS = ['#d9772b', '#e8a23a', '#b5521f', '#c9632a', '#e8c04a', '#9a3a1a'];

/** Dark, mid and light tones for one autumn tree. */
const CANOPIES = [
  ['#6a2a12', '#c05a26', '#e89a3a', '#f6c860'],
  ['#561c14', '#a3361f', '#d26a2a', '#eea050'],
  ['#6e4a12', '#c08a2a', '#e2b84a', '#f6dc80'],
];

/** A ragged autumn canopy built from many small clumps: dark underneath, lit on top. */
function canopy(ctx: Ctx, cx: number, trunkW: number, leaf: () => number): void {
  const [dark, mid, light, glint] = CANOPIES[Math.floor(leaf() * CANOPIES.length)];
  // Branches fanning up into the leaves.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26; i++) rect(ctx, cx + side * (trunkW / 2 + i * 1.3), 56 - i, 2, 2, '#3b2a20');
  }
  const clumps = (n: number, r0: number, r1: number, yOff: number, color: string, spreadX: number) => {
    for (let k = 0; k < n; k++) {
      const a = leaf() * Math.PI;
      const dist = Math.sqrt(leaf());
      const x = cx + Math.cos(a) * spreadX * dist * (leaf() < 0.5 ? -1 : 1);
      const y = 24 - Math.sin(a) * 26 * dist + yOff;
      disc(ctx, x, y, Math.round(r0 + leaf() * (r1 - r0)), color);
    }
  };
  clumps(30, 6, 10, 8, dark, 60);
  clumps(34, 4, 8, 2, mid, 56);
  clumps(26, 3, 5, -4, light, 48);
  clumps(12, 1, 2, -8, glint, 42);
  // Ragged edge: loose leaves around the canopy.
  for (let k = 0; k < 70; k++) {
    const a = leaf() * Math.PI * 2;
    rect(ctx, cx + Math.cos(a) * (55 + leaf() * 14), 26 + Math.sin(a) * (28 + leaf() * 8), leaf() < 0.5 ? 2 : 1, 1, leaf() < 0.5 ? mid : dark);
  }
}

function nearTrees(): HTMLCanvasElement {
  const H = GROUND_Y + 6;
  const [c, ctx] = makeCanvas(VIEW_W, H);
  const rand = rng(21);
  let x = 30;
  while (x < VIEW_W - 20) {
    const w = 8 + Math.round(rand() * 8);
    const isPine = rand() < 0.35;
    const tx = x;
    wrapped((dx) => {
      const left = tx + dx - w / 2;
      // Trunk with bark stripes and a lit edge.
      rect(ctx, left, 0, w, H, isPine ? '#3b2a20' : '#4a3424');
      rect(ctx, left, 0, 2, H, isPine ? '#4d382a' : '#614532');
      rect(ctx, left + w - 2, 0, 2, H, '#2e2018');
      const bark = rng(Math.round(tx));
      for (let y = 0; y < H; y += 3 + Math.round(bark() * 5)) rect(ctx, left + 2 + Math.round(bark() * (w - 5)), y, 1, 2 + Math.round(bark() * 4), '#2e2018');
      // Roots flare at the base.
      rect(ctx, left - 3, H - 4, w + 6, 4, '#3b2a20');
      rect(ctx, left - 5, H - 2, w + 10, 2, '#33241a');
      if (isPine) {
        for (let b = 0; b < 4; b++) {
          const by = 6 + b * 14;
          rect(ctx, left - 18 + b * 2, by, w + 36 - b * 4, 5, '#1f3a2a');
          rect(ctx, left - 16 + b * 2, by, w + 32 - b * 4, 2, '#2c4d36');
        }
      } else {
        canopy(ctx, tx + dx, w, rng(Math.round(tx) + 7));
      }
    });
    x += 110 + Math.round(rand() * 120);
  }
  return c;
}

/** The walkable ground. Starts above the ground line so tufts and rocks can stick up. */
const GROUND_TOP = 200;

function ground(): HTMLCanvasElement {
  const H = VIEW_H - GROUND_TOP;
  const line = GROUND_Y - GROUND_TOP;
  const [c, ctx] = makeCanvas(VIEW_W, H);
  const rand = rng(31);
  rect(ctx, 0, line, VIEW_W, H - line, '#5a4030');
  rect(ctx, 0, line, VIEW_W, 2, '#8f9c4c');
  rect(ctx, 0, line + 2, VIEW_W, 2, '#6f7f3a');
  rect(ctx, 0, line + 4, VIEW_W, 1, '#56632e');
  // Earth darkens toward the bottom of the screen, in dithered steps.
  for (let y = line + 5; y < H; y++) {
    const t = (y - line - 5) / (H - line - 5);
    for (let x = (y % 2) * 1; x < VIEW_W; x += 2) {
      if (t > 0.35) rect(ctx, x, y, 1, 1, '#4a3526');
      if (t > 0.7) rect(ctx, x + 1, y, 1, 1, '#3f2d20');
    }
  }
  // Fallen leaves, thickest just below the grass.
  for (let i = 0; i < 320; i++) {
    const depth = Math.pow(rand(), 2.2);
    const y = line + 5 + Math.floor(depth * (H - line - 6));
    const col = LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)];
    ctx.globalAlpha = 1 - depth * 0.6;
    rect(ctx, Math.floor(rand() * VIEW_W), y, rand() < 0.6 ? 2 : 1, 1, col);
  }
  ctx.globalAlpha = 1;
  // Grass tufts poking up.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * VIEW_W);
    const h = 2 + Math.floor(rand() * 5);
    wrapped((dx) => {
      rect(ctx, x + dx, line - h, 1, h, '#7c8c40');
      rect(ctx, x + dx + 1, line - h + 2, 1, h - 2, '#5f6e32');
      rect(ctx, x + dx - 1, line - h + 1, 1, h - 1, '#93a250');
    });
  }
  // Rocks, mushrooms and a fallen log.
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * VIEW_W);
    const w = 4 + Math.floor(rand() * 6);
    wrapped((dx) => {
      rect(ctx, x + dx, line - 3, w, 4, '#7d7a72');
      rect(ctx, x + dx + 1, line - 4, w - 2, 1, '#9a978e');
      rect(ctx, x + dx, line, w, 1, '#55524b');
    });
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * VIEW_W);
    wrapped((dx) => {
      rect(ctx, x + dx, line - 3, 1, 3, '#e8dcc0');
      rect(ctx, x + dx - 1, line - 5, 3, 2, '#c0442c');
      rect(ctx, x + dx, line - 5, 1, 1, '#f2e6d0');
    });
  }
  const logX = Math.floor(rand() * VIEW_W);
  wrapped((dx) => {
    rect(ctx, logX + dx, line - 7, 46, 7, '#5e4330');
    rect(ctx, logX + dx, line - 7, 46, 2, '#7a5a40');
    rect(ctx, logX + dx + 46, line - 7, 3, 7, '#c9a57a');
    rect(ctx, logX + dx + 47, line - 5, 1, 3, '#8a6a48');
    rect(ctx, logX + dx + 10, line - 8, 8, 1, '#4f7a3a');
  });
  return c;
}

function foreground(): HTMLCanvasElement {
  const H = 40;
  const [c, ctx] = makeCanvas(VIEW_W, H);
  const rand = rng(41);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * VIEW_W);
    const big = rand() < 0.4;
    wrapped((dx) => {
      // A fern: fronds fanning out from the bottom.
      const fronds = big ? 7 : 4;
      for (let f = 0; f < fronds; f++) {
        const ang = Math.PI * (0.15 + (0.7 * f) / (fronds - 1));
        const len = (big ? 30 : 16) * (0.7 + rand() * 0.3);
        for (let s = 0; s < len; s++) {
          const fx = x + dx + Math.cos(ang) * s * (f % 2 ? 1 : -1) * 0.9;
          const fy = H - Math.sin(ang) * s;
          rect(ctx, fx, fy, 2, 2, s > len * 0.7 ? '#3a4d26' : '#22301a');
        }
      }
    });
  }
  return c;
}

// ---------- Small textures ----------

function sunTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.globalAlpha = 0.15;
  disc(ctx, 16, 16, 14, '#fff1c8');
  ctx.globalAlpha = 0.3;
  disc(ctx, 16, 16, 10, '#fff1c8');
  ctx.globalAlpha = 1;
  disc(ctx, 16, 16, 6, '#fff8e6');
  return c;
}

function moonTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(16, 16);
  ctx.globalAlpha = 0.2;
  disc(ctx, 8, 8, 7, '#dfe6ff');
  ctx.globalAlpha = 1;
  disc(ctx, 8, 8, 4, '#eef0ff');
  rect(ctx, 7, 6, 2, 1, '#c8cce6');
  rect(ctx, 9, 9, 1, 1, '#c8cce6');
  return c;
}

function starsTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 160);
  const rand = rng(51);
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rand() * VIEW_W);
    const y = Math.floor(rand() * 160);
    rect(ctx, x, y, 1, 1, rand() < 0.3 ? '#ffffff' : '#9fa8d8');
    if (rand() < 0.06) {
      rect(ctx, x - 1, y, 3, 1, '#c8d0ff');
      rect(ctx, x, y - 1, 1, 3, '#c8d0ff');
    }
  }
  return c;
}

function mistTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 40);
  const rand = rng(61);
  const wave = ridgeNoise(rand, [[3, 4], [7, 2], [17, 1]]);
  for (let x = 0; x < VIEW_W; x++) {
    const top = 14 + Math.round(wave(x));
    for (let y = top; y < 40; y++) {
      // Stepped opacity: soft, but still made of crisp bands.
      const t = Math.min(1, (y - top) / 14) * (1 - Math.max(0, (y - 32) / 8));
      ctx.globalAlpha = Math.round(t * 4) / 4;
      rect(ctx, x, y, 1, 1, '#ffffff');
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

function rayTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(90, 220);
  for (let y = 0; y < 220; y++) {
    const x = Math.round(60 - y * 0.25);
    ctx.globalAlpha = 0.5 * (1 - y / 220);
    rect(ctx, x, y, 18, 1, '#ffffff');
  }
  return c;
}

export function createScenery(scene: Phaser.Scene): void {
  const t = scene.textures;
  if (t.exists('bg-mountains')) return;
  t.addCanvas('bg-mountains', mountains());
  t.addCanvas('bg-ridge', ridge());
  t.addCanvas('bg-far', forest(110, 13, 70, 30, 70, 0.3, '#e8e8e8'));
  t.addCanvas('bg-mid', forest(140, 14, 34, 55, 110, 0.28, '#e0e0e0'));
  t.addCanvas('bg-big', forest(190, 15, 12, 120, 175, 0.26, '#d8d8d8'));
  t.addCanvas('bg-near', nearTrees());
  t.addCanvas('bg-ground', ground());
  t.addCanvas('bg-front', foreground());
  t.addCanvas('sun', sunTexture());
  t.addCanvas('moon', moonTexture());
  t.addCanvas('stars', starsTexture());
  t.addCanvas('mist', mistTexture());
  t.addCanvas('ray', rayTexture());
  for (const [key, rows] of [['bird-up', ['x...x', '.x.x.']], ['bird-down', ['.xxx.', 'x...x']]] as const) {
    const [c, ctx] = makeCanvas(5, 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'x' && rect(ctx, x, y, 1, 1, '#2a2630')));
    t.addCanvas(key, c);
  }
}

// ---------- The living backdrop ----------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

interface Particle {
  obj: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  phase: number;
}

export interface BackdropOptions {
  /** True when the camera scrolls (the hunt). False for the still camp scene. */
  scrolling: boolean;
}

export class Backdrop {
  /** Multiply color for near objects and characters. */
  light = 0xffffff;
  grade: Grade = gradeAt(12);

  private skyTex: Phaser.Textures.CanvasTexture;
  private lastSkyHour = -1;
  private stars: Phaser.GameObjects.TileSprite;
  private sun: Phaser.GameObjects.Image;
  private moon: Phaser.GameObjects.Image;
  private far: [Phaser.GameObjects.TileSprite, number, number][] = [];
  private near: [Phaser.GameObjects.TileSprite, number][] = [];
  private mists: Phaser.GameObjects.TileSprite[] = [];
  private rays: Phaser.GameObjects.Image[] = [];
  private leaves: Particle[] = [];
  private flies: Particle[] = [];
  private birds: Phaser.GameObjects.Image[] = [];
  private lastScroll = 0;
  private time = 0;

  constructor(private scene: Phaser.Scene, opts: BackdropOptions) {
    createScenery(scene);
    this.skyTex = scene.textures.exists('sky')
      ? (scene.textures.get('sky') as Phaser.Textures.CanvasTexture)
      : scene.textures.createCanvas('sky', VIEW_W, VIEW_H)!;
    scene.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.stars = scene.add.tileSprite(0, 0, VIEW_W, 160, 'stars').setOrigin(0).setScrollFactor(0).setDepth(-99);
    this.sun = scene.add.image(0, 0, 'sun').setScrollFactor(0).setDepth(-98);
    this.moon = scene.add.image(0, 0, 'moon').setScrollFactor(0).setDepth(-98);

    const layer = (key: string, bottom: number, h: number, depth: number) =>
      scene.add.tileSprite(0, bottom - h, VIEW_W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
    this.far.push([layer('bg-mountains', 205, 120, -90), 0.04, 0]);
    this.far.push([layer('bg-ridge', 212, 90, -85), 0.1, 1]);
    this.far.push([layer('bg-far', 220, 110, -80), 0.2, 2]);
    this.mists.push(layer('mist', 214, 40, -79));
    this.far.push([layer('bg-mid', 224, 140, -75), 0.35, 3]);
    this.mists.push(layer('mist', 226, 40, -74).setFlipX(true));
    this.far.push([layer('bg-big', 226, 190, -70), 0.55, 4]);

    for (let i = 0; i < 3; i++) {
      this.rays.push(scene.add.image(80 + i * 140, 0, 'ray').setOrigin(0).setScrollFactor(0).setDepth(-65).setBlendMode(Phaser.BlendModes.ADD));
    }
    if (opts.scrolling) this.near.push([layer('bg-near', GROUND_Y + 6, GROUND_Y + 6, -60), 0.8]);
    this.near.push([layer('bg-ground', VIEW_H, VIEW_H - GROUND_TOP, -50), 1]);
    if (opts.scrolling) this.near.push([layer('bg-front', VIEW_H, 40, 50), 1.3]);

    for (let i = 0; i < 28; i++) {
      const obj = scene.add.rectangle(Math.random() * VIEW_W, Math.random() * VIEW_H, Math.random() < 0.5 ? 2 : 1, 1, Phaser.Display.Color.HexStringToColor(LEAF_COLORS[i % LEAF_COLORS.length]).color);
      obj.setOrigin(0).setScrollFactor(0).setDepth(55);
      this.leaves.push({ obj, vx: 0, vy: 8 + Math.random() * 10, phase: Math.random() * 10 });
    }
    for (let i = 0; i < 22; i++) {
      const obj = scene.add.rectangle(Math.random() * VIEW_W, 120 + Math.random() * 100, 1, 1, 0xfff27a).setOrigin(0).setScrollFactor(0).setDepth(56);
      this.flies.push({ obj, vx: 0, vy: 0, phase: Math.random() * 10 });
    }
  }

  /** Call every frame. windDir is +1 (blowing right) or -1. */
  update(hour: number, scrollX: number, dt: number, windDir: 1 | -1 = 1): void {
    this.time += dt;
    const g = gradeAt(hour);
    this.grade = g;
    this.light = g.light;
    const night = Phaser.Math.Clamp(nightness(hour), 0, 1);
    const gold = golden(hour);

    if (Math.abs(hour - this.lastSkyHour) > 0.03) {
      this.drawSky(g);
      this.lastSkyHour = hour;
    }
    this.stars.setAlpha(night);

    // Sun and moon arc across the sky.
    const dayT = (hour - 6.3) / (18.7 - 6.3);
    this.sun.setVisible(dayT > -0.05 && dayT < 1.05);
    this.sun.setPosition(Math.round(40 + dayT * 400), Math.round(200 - Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI) * 150));
    this.sun.setTint(lerpColor(0xffffff, 0xffa060, gold));
    const nightT = hour > 12 ? (hour - 18.7) / 11 : (hour + 5.3) / 11;
    this.moon.setPosition(Math.round(40 + nightT * 400), Math.round(180 - Math.sin(Math.max(0, Math.min(1, nightT)) * Math.PI) * 140));
    this.moon.setAlpha(night);

    for (const [t, f, i] of this.far) {
      t.tilePositionX = Math.round(scrollX * f) % VIEW_W;
      t.setTint(g.layers[i]);
    }
    this.mists.forEach((m, i) => {
      m.tilePositionX = Math.round(scrollX * (0.25 + i * 0.15) + this.time * (2 + i)) % VIEW_W;
      m.setTint(g.mist).setAlpha(g.mistAlpha);
    });
    this.rays.forEach((r, i) => {
      r.setAlpha(gold * (0.35 + Math.sin(this.time * 0.6 + i * 2) * 0.12));
      r.setTint(lerpColor(0xffe0a0, 0xffb070, gold));
      r.x = Math.round(80 + i * 140 - ((scrollX * 0.6) % 480));
      if (r.x < -100) r.x += 480;
    });
    // Near layers pick up a bit of the haze color as well as the light.
    const nearTint = lerpColor(this.light, g.layers[4], 0.12);
    for (const [t, f] of this.near) {
      t.tilePositionX = Math.round(scrollX * f) % VIEW_W;
      t.setTint(f > 1 ? lerpColor(nearTint, 0x000000, 0.25) : nearTint);
    }

    const scrollDelta = scrollX - this.lastScroll;
    this.lastScroll = scrollX;
    this.updateLeaves(dt, scrollDelta, windDir, night);
    this.updateFireflies(dt, scrollDelta, night);
    this.updateBirds(dt, night);
  }

  private drawSky(g: Grade): void {
    const ctx = this.skyTex.getContext();
    const img = ctx.createImageData(VIEW_W, VIEW_H);
    const levels = 14;
    for (let y = 0; y < VIEW_H; y++) {
      const t = Math.min(1, Math.pow(y / (VIEW_H * 0.8), 1.3)) * levels;
      for (let x = 0; x < VIEW_W; x++) {
        // Ordered dithering between color bands: the classic pixel-art gradient.
        const step = Math.floor(t) + ((t % 1) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0);
        const c = lerpColor(g.skyTop, g.skyBottom, Math.min(1, step / levels));
        const o = (y * VIEW_W + x) * 4;
        img.data[o] = (c >> 16) & 255;
        img.data[o + 1] = (c >> 8) & 255;
        img.data[o + 2] = c & 255;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.skyTex.refresh();
  }

  private updateLeaves(dt: number, scrollDelta: number, windDir: 1 | -1, night: number): void {
    for (const p of this.leaves) {
      p.phase += dt * 2;
      p.obj.x += (windDir * 14 + Math.sin(p.phase) * 10) * dt - scrollDelta * 1.1;
      p.obj.y += p.vy * dt;
      if (p.obj.y > VIEW_H || p.obj.x < -10 || p.obj.x > VIEW_W + 10) {
        p.obj.y = -4 - Math.random() * 40;
        p.obj.x = Math.random() * VIEW_W;
      }
      p.obj.setAlpha(1 - night * 0.7);
    }
  }

  private updateFireflies(dt: number, scrollDelta: number, night: number): void {
    const show = night > 0.2 ? night : 0;
    for (const p of this.flies) {
      p.phase += dt;
      p.obj.x += Math.sin(p.phase * 0.7) * 6 * dt - scrollDelta * 0.9;
      p.obj.y += Math.cos(p.phase * 0.9) * 4 * dt;
      if (p.obj.x < -5) p.obj.x += VIEW_W + 10;
      if (p.obj.x > VIEW_W + 5) p.obj.x -= VIEW_W + 10;
      p.obj.setAlpha(show * Math.max(0, Math.sin(p.phase * 2.3)));
    }
  }

  private updateBirds(dt: number, night: number): void {
    if (night < 0.5 && this.birds.length === 0 && Math.random() < dt * 0.05) {
      const y = 30 + Math.random() * 60;
      const fromLeft = Math.random() < 0.5;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        const b = this.scene.add
          .image(fromLeft ? -10 - i * 9 : VIEW_W + 10 + i * 9, y + (i % 2) * 4 + i * 2, 'bird-up')
          .setScrollFactor(0)
          .setDepth(-95)
          .setData('vx', fromLeft ? 30 : -30);
        this.birds.push(b);
      }
    }
    for (const b of this.birds) {
      b.x += (b.getData('vx') as number) * dt;
      b.setTexture(Math.sin(this.time * 12 + b.y) > 0 ? 'bird-up' : 'bird-down');
    }
    if (this.birds.length && this.birds.every((b) => b.x < -40 || b.x > VIEW_W + 40)) {
      this.birds.forEach((b) => b.destroy());
      this.birds = [];
    }
  }
}
