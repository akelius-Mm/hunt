import Phaser from 'phaser';
import { golden, gradeAt, lerpColor, nightness, type Grade } from './palette';
import { GROUND_Y, LAKE_HORIZON, VIEW_H, VIEW_W } from './view';

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

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

// ---------- Far layers: full-color golden autumn, veiled in haze by distance ----------

/** Light, mid, shadow and speck colors for one kind of tree. */
type TreeColors = [string, string, string, string];
const PINE: TreeColors = ['#3e6250', '#2c4a3c', '#203a2e', '#162a22'];
const LARCH: TreeColors = ['#f6d670', '#e2ae44', '#b47e2c', '#8a5a20'];
const ASPEN: TreeColors = ['#f8e48a', '#e8c450', '#c09a34', '#7a6a2a'];

/**
 * A conifer drawn pixel by pixel in tiers. Light falls from the left, so the left edge
 * is lit and the right side is in shadow, with random specks for needle texture.
 */
function tree(ctx: Ctx, cx: number, base: number, h: number, maxHalf: number, col: TreeColors, rand: () => number): void {
  const [hi, mid, lo, dark] = col;
  const top = base - h;
  const tiers = Math.max(3, Math.round(h / 12));
  for (let y = Math.round(top); y < base; y++) {
    const t = (y - top) / h;
    const f = (t * tiers) % 1;
    const half = Math.max(0.5, maxHalf * (0.18 + 0.82 * t) * (0.45 + 0.55 * f) + (rand() < 0.3 ? 1 : 0));
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    for (let x = x0; x <= x1; x++) {
      const side = (x - cx) / Math.max(1, half);
      const r = rand();
      let c = side < -0.35 ? hi : side > 0.3 ? lo : mid;
      if (r < 0.12) c = dark;
      else if (r < 0.2 && side < 0.3) c = hi;
      // The bottom of each tier sits in its own shadow.
      if (f > 0.85 && r < 0.6) c = lo;
      rect(ctx, x, y, 1, 1, c);
    }
  }
  if (h > 30) rect(ctx, cx, base - Math.round(h * 0.12), 1, Math.round(h * 0.12), '#3a2a20');
}

/** A rounded aspen or birch crown, built from clumps. */
function crown(ctx: Ctx, cx: number, base: number, h: number, col: TreeColors, rand: () => number): void {
  const [hi, mid, lo] = col;
  rect(ctx, cx, base - h * 0.45, 1, h * 0.45, '#e8e2d6');
  for (let k = 0; k < 7; k++) {
    const x = cx + (rand() - 0.5) * h * 0.4;
    const y = base - h * 0.55 - rand() * h * 0.3;
    const r = Math.max(2, Math.round(h * (0.12 + rand() * 0.08)));
    disc(ctx, x + 1, y + 1, r, lo);
    disc(ctx, x, y, r, mid);
    disc(ctx, x - r * 0.35, y - r * 0.35, Math.max(1, Math.round(r * 0.45)), hi);
  }
}

function mountains(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 120);
  const rand = rng(11);
  const back = ridgeNoise(rand, [[2, 20], [5, 10], [11, 4], [23, 2]]);
  const front = ridgeNoise(rand, [[3, 12], [7, 6], [17, 2]]);
  for (let x = 0; x < VIEW_W; x++) {
    // Back range: pale and snow-capped. Light comes from the left, so slopes falling to the right are shaded.
    const y = Math.round(34 + back(x));
    const shaded = back(x + 1) > back(x);
    for (let yy = y; yy < 120; yy++) {
      const snow = yy < y + 6 + Math.round(back(x * 3) * 0.3) && y < 40;
      const c = snow ? (shaded ? '#c4c8e0' : '#f4f2f8') : shaded ? '#7c84ac' : '#97a0c4';
      rect(ctx, x, yy, 1, 1, (yy + x) % 7 === 0 && !snow ? '#868fb6' : c);
    }
    // Front range: closer, darker, with rock streaks.
    const y2 = Math.round(66 + front(x));
    const shaded2 = front(x + 1) > front(x);
    for (let yy = y2; yy < 120; yy++) rect(ctx, x, yy, 1, 1, shaded2 ? '#5e6890' : (yy * 3 + x) % 11 === 0 ? '#6a7498' : '#737ea4');
    // Only the highest front peaks keep a little snow.
    if (y2 < 58) rect(ctx, x, y2, 1, 2, '#e8e8f2');
  }
  return c;
}

function ridge(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 90);
  const rand = rng(12);
  const hill = ridgeNoise(rand, [[3, 10], [7, 5], [13, 2]]);
  for (let x = 0; x < VIEW_W; x++) {
    const y = Math.round(46 + hill(x));
    for (let yy = y; yy < 90; yy++) rect(ctx, x, yy, 1, 1, rand() < 0.25 ? '#b8903a' : rand() < 0.5 ? '#3a564c' : '#46625a');
  }
  for (let i = 0; i < 110; i++) {
    const x = rand() * VIEW_W;
    const base = Math.round(49 + hill(x));
    const h = 6 + rand() * 10;
    const col = rand() < 0.45 ? LARCH : PINE;
    wrapped((dx) => tree(ctx, Math.round(x + dx), base, h, 2 + rand() * 2, col, rng(i + 7)));
  }
  return c;
}

/** A band of mixed forest: dark pines, golden larches and aspens. */
function forest(height: number, seed: number, count: number, minH: number, maxH: number, halfMul: number, gold: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, height);
  const rand = rng(seed);
  for (let x = 0; x < VIEW_W; x++) {
    for (let y = height - 18; y < height; y++) rect(ctx, x, y, 1, 1, rand() < gold * 0.6 ? '#c8962e' : rand() < 0.5 ? '#2a4236' : '#34503e');
  }
  const trees = Array.from({ length: count }, () => ({ x: Math.round(rand() * VIEW_W), h: minH + rand() * (maxH - minH), kind: rand() }));
  // Tall trees first, so shorter ones in front overlap them.
  trees.sort((a, b) => b.h - a.h);
  trees.forEach((t, i) => {
    const half = t.h * halfMul * (0.8 + rand() * 0.4);
    wrapped((dx) => {
      if (t.kind < gold * 0.25) crown(ctx, t.x + dx, height - 8, t.h * 0.7, ASPEN, rng(seed + i));
      else tree(ctx, t.x + dx, height - 8, t.h, half, t.kind < gold ? LARCH : PINE, rng(seed + i));
    });
  });
  return c;
}

/** Big drifting cumulus clouds: lit tops, lavender undersides. */
function clouds(seed: number, count: number, size: number): HTMLCanvasElement {
  const H = 110;
  const [c, ctx] = makeCanvas(VIEW_W, H);
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = rand() * VIEW_W;
    const cy = 30 + rand() * 50;
    const w = size * (0.7 + rand() * 0.6);
    const puffs = Array.from({ length: 7 }, () => ({ x: (rand() - 0.5) * w, y: -rand() * size * 0.35, r: Math.round(size * (0.18 + rand() * 0.16)) }));
    wrapped((dx) => {
      for (const p of puffs) disc(ctx, cx + dx + p.x, cy + p.y + 3, p.r, '#c4b8d8');
      for (const p of puffs) disc(ctx, cx + dx + p.x, cy + p.y, p.r, '#ece6ee');
      for (const p of puffs) disc(ctx, cx + dx + p.x - p.r * 0.3, cy + p.y - p.r * 0.35, Math.max(1, Math.round(p.r * 0.55)), '#ffffff');
      // Flat, shaded base.
      rect(ctx, cx + dx - w * 0.35, cy + 3, w * 0.7, 2, '#c4b8d8');
    });
  }
  return c;
}

/** Broken horizontal lines that make reflections read as moving water. */
function ripples(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(VIEW_W, 60);
  const rand = rng(81);
  for (let i = 0; i < 220; i++) {
    const y = Math.floor(rand() * 60);
    const w = 3 + Math.floor(rand() * (6 + y * 0.3));
    rect(ctx, Math.floor(rand() * VIEW_W), y, w, 1, rand() < 0.55 ? '#ffffff' : '#000000');
  }
  return c;
}

// ---------- Near layers: full color, multiplied by the light ----------

const LEAF_COLORS = ['#e8a23a', '#f0c050', '#d9772b', '#e8c04a', '#c9632a', '#f6d870'];

/** Dark, mid and light tones for one autumn tree. */
const CANOPIES = [
  ['#7a4a12', '#c88a22', '#e8b440', '#f8dc78'],
  ['#6a2a12', '#c05a26', '#e89a3a', '#f6c860'],
  ['#6e5212', '#c8a02a', '#ecc84e', '#fae890'],
  ['#7a4a12', '#d09a2c', '#f0c454', '#fbe796'],
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
    const kind = rand();
    const isPine = kind < 0.3;
    const isBirch = kind > 0.72;
    const tx = x;
    wrapped((dx) => {
      const left = tx + dx - w / 2;
      const bark = rng(Math.round(tx));
      if (isBirch) {
        // Birch: white bark with black horizontal marks.
        rect(ctx, left, 0, w, H, '#e8e2d6');
        rect(ctx, left, 0, 2, H, '#f8f4ec');
        rect(ctx, left + w - 2, 0, 2, H, '#b8b0a2');
        for (let y = 0; y < H; y += 4 + Math.round(bark() * 7)) rect(ctx, left + 1 + Math.round(bark() * (w - 4)), y, 2 + Math.round(bark() * 3), 1, '#2a2622');
      } else {
        // Trunk with bark stripes and a lit edge.
        rect(ctx, left, 0, w, H, isPine ? '#3b2a20' : '#4a3424');
        rect(ctx, left, 0, 2, H, isPine ? '#4d382a' : '#614532');
        rect(ctx, left + w - 2, 0, 2, H, '#2e2018');
        for (let y = 0; y < H; y += 3 + Math.round(bark() * 5)) rect(ctx, left + 2 + Math.round(bark() * (w - 5)), y, 1, 2 + Math.round(bark() * 4), '#2e2018');
      }
      // Roots flare at the base.
      rect(ctx, left - 3, H - 4, w + 6, 4, isBirch ? '#8a8072' : '#3b2a20');
      rect(ctx, left - 5, H - 2, w + 10, 2, '#33241a');
      if (isPine) {
        // Drooping boughs with lit upper edges and needle texture.
        for (let k = 0; k < 5; k++) {
          const by = 2 + k * 13;
          const reach = w / 2 + 20 - k * 2;
          for (let i = -reach; i <= reach; i++) {
            const droop = Math.round((i * i) / (reach * 6));
            rect(ctx, tx + dx + i, by + droop, 1, 5, bark() < 0.15 ? '#162a20' : '#1f3a2a');
            rect(ctx, tx + dx + i, by + droop, 1, 1, bark() < 0.5 ? '#3e6250' : '#2c4d36');
          }
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
  rect(ctx, 0, line, VIEW_W, 2, '#d8bc5c');
  rect(ctx, 0, line + 2, VIEW_W, 2, '#b8983e');
  rect(ctx, 0, line + 4, VIEW_W, 1, '#8a7030');
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
      rect(ctx, x + dx, line - h, 1, h, '#c8a84a');
      rect(ctx, x + dx + 1, line - h + 2, 1, h - 2, '#9a7c34');
      rect(ctx, x + dx - 1, line - h + 1, 1, h - 1, '#e8cc6c');
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
          rect(ctx, fx, fy, 2, 2, s > len * 0.7 ? '#b8702a' : '#6a3a18');
        }
      }
    });
  }
  return c;
}

/** Cattails and reeds along the shore, in patches so ducks show through the gaps. */
function reeds(): HTMLCanvasElement {
  const H = 56;
  const [c, ctx] = makeCanvas(VIEW_W, H);
  const rand = rng(71);
  for (let p = 0; p < 7; p++) {
    const px = rand() * VIEW_W;
    const width = 20 + rand() * 40;
    for (let i = 0; i < width / 2; i++) {
      const x = Math.round(px + (rand() - 0.5) * width);
      const h = 14 + Math.round(rand() * 34);
      const lean = rand() < 0.5 ? -1 : 1;
      wrapped((dx) => {
        for (let y = 0; y < h; y++) rect(ctx, x + dx + Math.round((lean * y * y) / 900), H - y, 1, 1, y > h * 0.6 ? '#6b7a3a' : '#4a5a2a');
        const top = x + dx + Math.round((lean * h * h) / 900);
        if (rand() < 0.55) {
          rect(ctx, top, H - h - 2, 2, 6, '#5a3a22');
          rect(ctx, top, H - h - 2, 1, 6, '#7a5232');
          rect(ctx, top, H - h - 4, 1, 2, '#6b7a3a');
        }
        // A long leaf blade arching out.
        if (rand() < 0.4) for (let k = 0; k < 10; k++) rect(ctx, x + dx + lean * k, H - Math.round(h * 0.5) - Math.round(Math.sin((k / 10) * Math.PI) * 5) + k, 1, 1, '#5d6c34');
      });
    }
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
  t.addCanvas('bg-far', forest(110, 13, 80, 26, 66, 0.3, 0.55));
  t.addCanvas('bg-mid', forest(140, 14, 40, 50, 110, 0.28, 0.5));
  t.addCanvas('bg-big', forest(190, 15, 13, 110, 175, 0.26, 0.45));
  t.addCanvas('clouds-far', clouds(91, 6, 26));
  t.addCanvas('clouds-near', clouds(92, 4, 46));
  t.addCanvas('ripples', ripples());
  t.addCanvas('bg-near', nearTrees());
  t.addCanvas('bg-ground', ground());
  t.addCanvas('bg-front', foreground());
  t.addCanvas('bg-reeds', reeds());
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

/** How strongly each far layer (farthest first) fades into the haze. */
const HAZE = [0.6, 0.47, 0.35, 0.23, 0.12];

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
  /** Open water that mirrors the sky and far shore. */
  lake?: boolean;
}

interface Glint {
  obj: Phaser.GameObjects.Rectangle;
  baseX: number;
  phase: number;
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
  /** Solid-color copies of the far layers that veil them in haze. */
  private hazes: [Phaser.GameObjects.TileSprite, number, number][] = [];
  private clouds: [Phaser.GameObjects.TileSprite, number, number][] = [];
  private ripple: Phaser.GameObjects.TileSprite | null = null;
  private near: [Phaser.GameObjects.TileSprite, number][] = [];
  private mists: Phaser.GameObjects.TileSprite[] = [];
  private rays: Phaser.GameObjects.Image[] = [];
  private leaves: Particle[] = [];
  private flies: Particle[] = [];
  private birds: Phaser.GameObjects.Image[] = [];
  private reflections: [Phaser.GameObjects.TileSprite, number, number][] = [];
  private glints: Glint[] = [];
  private sunGlints: Phaser.GameObjects.Rectangle[] = [];
  /** Where the sky meets the land (or the water, at the lake). */
  private horizon: number;
  private lastScroll = 0;
  private time = 0;

  constructor(private scene: Phaser.Scene, private opts: BackdropOptions) {
    this.horizon = opts.lake ? LAKE_HORIZON : VIEW_H;
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
    // At the lake the far shore sits higher, leaving room for the water below it.
    const lift = opts.lake ? 226 - LAKE_HORIZON : 0;
    const farLayers: [string, number, number, number, number][] = [
      ['bg-mountains', 205, 120, -90, 0.04],
      ['bg-ridge', 212, 90, -85, 0.1],
      ['bg-far', 220, 110, -80, 0.2],
      ['bg-mid', 224, 140, -75, 0.35],
      ['bg-big', 226, 190, -70, 0.55],
    ];
    farLayers.forEach(([key, bottom, h, depth, f], i) => {
      // Across open water, the tall near forest is too far away to tower over you.
      if (opts.lake && key === 'bg-big') return;
      this.far.push([layer(key, bottom - lift, h, depth), f, i]);
      // Atmospheric perspective: the farther the layer, the more it fades into the haze.
      this.hazes.push([layer(key, bottom - lift, h, depth + 0.05), f, i]);
      if (opts.lake) {
        // The mirror image: flipped about the horizon, behind a veil of water.
        const r = scene.add
          .tileSprite(0, 2 * LAKE_HORIZON - (bottom - lift), VIEW_W, h, key)
          .setOrigin(0)
          .setScrollFactor(0)
          .setFlipY(true)
          .setDepth(-62 + i * 0.1);
        this.reflections.push([r, f, i]);
      }
    });
    this.clouds.push([layer('clouds-far', 110, 110, -97), 0.02, 3]);
    this.clouds.push([layer('clouds-near', 125, 110, -96), 0.05, 6]);
    if (opts.lake) {
      this.ripple = scene.add
        .tileSprite(0, LAKE_HORIZON + 2, VIEW_W, GROUND_Y - LAKE_HORIZON, 'ripples')
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(-57);
    }
    this.mists.push(layer('mist', 214 - lift, 40, -79));
    this.mists.push(layer('mist', 226 - lift, 40, -74).setFlipX(true));
    if (opts.lake) this.mists.push(layer('mist', LAKE_HORIZON + 14, 40, -58));

    if (opts.lake) {
      for (let i = 0; i < 34; i++) {
        const obj = scene.add
          .rectangle(0, LAKE_HORIZON + 3 + Math.random() * (GROUND_Y - LAKE_HORIZON - 6), 2 + Math.floor(Math.random() * 9), 1, 0xffffff)
          .setOrigin(0)
          .setScrollFactor(0)
          .setDepth(-56)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.glints.push({ obj, baseX: Math.random() * VIEW_W, phase: Math.random() * 10 });
      }
      for (let i = 0; i < 14; i++) {
        this.sunGlints.push(scene.add.rectangle(0, LAKE_HORIZON + 2 + i * 4, 4, 1, 0xfff0c0).setOrigin(0.5, 0).setScrollFactor(0).setDepth(-55).setBlendMode(Phaser.BlendModes.ADD));
      }
    }

    for (let i = 0; i < 3; i++) {
      this.rays.push(scene.add.image(80 + i * 140, 0, 'ray').setOrigin(0).setScrollFactor(0).setDepth(-65).setBlendMode(Phaser.BlendModes.ADD));
    }
    if (opts.scrolling && !opts.lake) this.near.push([layer('bg-near', GROUND_Y + 6, GROUND_Y + 6, -60), 0.8]);
    if (opts.lake) this.near.push([layer('bg-reeds', GROUND_Y + 3, 56, -45), 0.9]);
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
    const sunBase = this.opts.lake ? LAKE_HORIZON - 10 : 200;
    this.sun.setPosition(Math.round(40 + dayT * 400), Math.round(sunBase - Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI) * (sunBase - 50)));
    this.sun.setTint(lerpColor(0xffffff, 0xffa060, gold));
    const nightT = hour > 12 ? (hour - 18.7) / 11 : (hour + 5.3) / 11;
    this.moon.setPosition(Math.round(40 + nightT * 400), Math.round(180 - Math.sin(Math.max(0, Math.min(1, nightT)) * Math.PI) * 140));
    this.moon.setAlpha(night);

    for (const [t, f] of this.far) {
      t.tilePositionX = Math.round(scrollX * f) % VIEW_W;
      t.setTint(this.light);
    }
    for (const [t, f, i] of this.hazes) {
      t.tilePositionX = Math.round(scrollX * f) % VIEW_W;
      t.setTintFill(g.layers[i]).setAlpha(HAZE[i] + night * 0.2);
    }
    for (const [t, f, drift] of this.clouds) {
      t.tilePositionX = Math.round(scrollX * f + this.time * drift) % VIEW_W;
      // Clouds take on the sky's color at dawn and dusk.
      t.setTint(lerpColor(this.light, g.skyBottom, 0.3)).setAlpha(1 - night * 0.65);
    }
    for (const [t, f, i] of this.reflections) {
      t.tilePositionX = Math.round(scrollX * f) % VIEW_W;
      t.setTint(lerpColor(lerpColor(this.light, g.layers[i], HAZE[i]), 0x101820, 0.35)).setAlpha(0.7);
    }
    if (this.ripple) {
      this.ripple.tilePositionX = Math.round(scrollX * 0.6 + this.time * 3) % VIEW_W;
      this.ripple.setTint(lerpColor(g.skyBottom, 0xffffff, 0.3)).setAlpha(0.16);
    }
    if (this.opts.lake) this.updateWater(scrollX, gold, night);
    this.mists.forEach((m, i) => {
      m.tilePositionX = Math.round(scrollX * (0.25 + i * 0.15) + this.time * (2 + i)) % VIEW_W;
      m.setTint(g.mist).setAlpha(this.opts.lake ? g.mistAlpha * (i === 2 ? 0.35 : 0.6) : g.mistAlpha);
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

  /** Sparkles drifting on the water, and a broken column of sunlight under the sun. */
  private updateWater(scrollX: number, gold: number, night: number): void {
    for (const gl of this.glints) {
      gl.phase += 0.016;
      let x = (gl.baseX - scrollX * 0.5 + Math.sin(gl.phase) * 4) % VIEW_W;
      if (x < 0) x += VIEW_W;
      gl.obj.x = Math.round(x);
      gl.obj.setFillStyle(lerpColor(this.grade.skyBottom, 0xffffff, 0.5));
      gl.obj.setAlpha(Math.max(0, Math.sin(gl.phase * 2.1)) * (0.35 - night * 0.2));
    }
    const sunUp = this.sun.visible && this.sun.y < LAKE_HORIZON;
    this.sunGlints.forEach((s, i) => {
      s.x = Math.round(this.sun.x + Math.sin(this.time * 3 + i * 1.7) * (1 + i * 0.6));
      s.width = Math.max(1, Math.round(6 - i * 0.3 + Math.sin(this.time * 5 + i) * 2));
      s.setFillStyle(lerpColor(0xfff4d8, 0xffa060, gold));
      s.setAlpha(sunUp ? (0.55 - i * 0.03) * (0.5 + gold * 0.5) * (0.6 + Math.sin(this.time * 4 + i * 2) * 0.4) : 0);
    });
  }

  private drawSky(g: Grade): void {
    const ctx = this.skyTex.getContext();
    const img = ctx.createImageData(VIEW_W, VIEW_H);
    const levels = 14;
    const H = this.horizon;
    for (let y = 0; y < VIEW_H; y++) {
      // Below the horizon at the lake, the water mirrors the sky, a little darker.
      const below = y > H;
      const sy = below ? 2 * H - y : y;
      const span = this.opts.lake ? H : VIEW_H * 0.8;
      const t = Math.min(1, Math.pow(Math.max(0, sy) / span, 1.3)) * levels;
      for (let x = 0; x < VIEW_W; x++) {
        // Ordered dithering between color bands: the classic pixel-art gradient.
        const step = Math.floor(t) + ((t % 1) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0);
        let c = lerpColor(g.skyTop, g.skyBottom, Math.min(1, step / levels));
        if (below) c = lerpColor(c, 0x16222e, 0.28 + ((y - H) / (GROUND_Y - H)) * 0.2);
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
