import Phaser from 'phaser';
import { golden, gradeAt, lerpColor, nightness, type Grade } from './palette';
import { GROUND_Y, LAKE_HORIZON, PX, SCREEN_H, SCREEN_W, VIEW_H, VIEW_W } from './view';

/*
 * All scenery is generated at screen resolution (PX times the world), one canvas pixel
 * per screen pixel. Sizes below are written as world units times P.
 */
const P = PX;
const W = SCREEN_W;

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
  c.width = Math.round(w);
  c.height = Math.round(h);
  return [c, c.getContext('2d')!];
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** Draws at x, x - W and x + W so the layer tiles seamlessly. */
function wrapped(draw: (dx: number) => void): void {
  for (const dx of [-W, 0, W]) draw(dx);
}

/** Periodic noise built from sines whose periods divide the layer width, so it tiles. */
function ridgeNoise(rand: () => number, octaves: [number, number][]): (x: number) => number {
  const phases = octaves.map(() => rand() * Math.PI * 2);
  return (x) => octaves.reduce((sum, [cycles, amp], i) => sum + Math.sin((x / W) * Math.PI * 2 * cycles + phases[i]) * amp * P, 0);
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
const PINE: TreeColors = ['#5c8a6a', '#3f6a52', '#2d4f3e', '#213a2e'];
const LARCH: TreeColors = ['#f0d484', '#d6a854', '#a97c3a', '#7e5a2a'];
const ASPEN: TreeColors = ['#f6e49a', '#e4c25e', '#bc9840', '#80702e'];

/**
 * A conifer in the cozy style: rounded tiers of foliage built from overlapping clumps,
 * three tones each (shadow underneath, mid, a lit cap on the upper left), narrowing to a
 * soft tip. No single-pixel noise: the shapes do the work.
 */
function tree(ctx: Ctx, cx: number, base: number, h: number, maxHalf: number, col: TreeColors, rand: () => number): void {
  const [hi, mid, lo, dark] = col;
  const top = base - h;
  const tiers = Math.max(3, Math.round(h / (7 * P)));
  // Trunk first; the foliage hangs over it.
  rect(ctx, cx - P, base - h * 0.6, 2 * P, h * 0.6, '#4a3326');
  rect(ctx, cx - P, base - h * 0.6, P, h * 0.6, '#5c4030');
  for (let k = tiers - 1; k >= 0; k--) {
    const t = (k + 1) / tiers;
    const y = top + t * h;
    const half = Math.max(2 * P, maxHalf * (0.2 + 0.8 * t));
    const r = Math.max(2.5 * P, Math.min(half * 0.6, (4.5 + rand() * 2) * P * (0.55 + 0.45 * t)));
    const n = Math.max(1, Math.round(half / (r * 0.9)));
    // Shadow under the whole tier, then clumps from the outside in so the middle sits on top.
    for (let i = -n; i <= n; i++) {
      const x = cx + (i / n) * (half - r * 0.6);
      const droop = (Math.abs(i) / n) * r * 0.6;
      disc(ctx, x, y - r * 0.5 + droop + P, r, dark);
    }
    const order = Array.from({ length: 2 * n + 1 }, (_, m) => m - n).sort((a, b) => Math.abs(b) - Math.abs(a));
    for (const i of order) {
      const x = cx + (i / n) * (half - r * 0.6);
      const droop = (Math.abs(i) / n) * r * 0.6;
      const cy = y - r * 0.5 + droop;
      // The right side sits in shadow; the left catches the light.
      disc(ctx, x, cy, r, i > 0 ? lo : mid);
      if (i <= 0) disc(ctx, x - r * 0.3, cy - r * 0.4, Math.max(1, Math.round(r * 0.5)), hi);
      else disc(ctx, x - r * 0.4, cy - r * 0.4, Math.max(1, Math.round(r * 0.35)), mid);
    }
  }
  // A soft tip.
  disc(ctx, cx, top + 2 * P, Math.max(1, Math.round(2.5 * P)), mid);
  disc(ctx, cx - 1, top + P, Math.max(1, Math.round(1.5 * P)), hi);
}

/** A rounded aspen or birch crown, built from clumps, on a white trunk. */
function crown(ctx: Ctx, cx: number, base: number, h: number, col: TreeColors, rand: () => number): void {
  const [hi, mid, lo, dark] = col;
  rect(ctx, cx - 1, base - h * 0.45, 2, h * 0.45, '#e8e2d6');
  rect(ctx, cx, base - h * 0.4, 1, 2, '#2a2622');
  for (let k = 0; k < 11; k++) {
    const x = cx + (rand() - 0.5) * h * 0.42;
    const y = base - h * 0.55 - rand() * h * 0.32;
    const r = Math.max(2, Math.round(h * (0.1 + rand() * 0.07)));
    disc(ctx, x + 1, y + 2, r, lo);
    disc(ctx, x, y, r, mid);
    disc(ctx, x - r * 0.35, y - r * 0.35, Math.max(1, Math.round(r * 0.45)), hi);
  }
  // Leaf speckle.
  for (let k = 0; k < h * 1.5; k++) rect(ctx, cx + (rand() - 0.5) * h * 0.6, base - h * 0.45 - rand() * h * 0.5, 1, 1, rand() < 0.5 ? dark : hi);
}

function mountains(): HTMLCanvasElement {
  const H = 120 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(11);
  const back = ridgeNoise(rand, [[2, 20], [5, 10], [11, 4], [23, 2], [47, 0.8]]);
  const front = ridgeNoise(rand, [[3, 12], [7, 6], [17, 2], [41, 0.8]]);
  for (let x = 0; x < W; x++) {
    // Back range: pale and snow-capped. Light comes from the left, so slopes falling right are shaded.
    const y = Math.round(34 * P + back(x));
    const shaded = back(x + 2) > back(x);
    for (let yy = y; yy < H; yy++) {
      const snow = yy < y + 6 * P + Math.round(back(x * 3) * 0.3) && y < 40 * P;
      let col = snow ? (shaded ? '#c4c8e0' : '#f4f2f8') : shaded ? '#7c84ac' : '#97a0c4';
      // Rock strata and snow-filled gullies.
      if (!snow && (yy * 2 + x) % 13 === 0) col = '#868fb6';
      if (!snow && yy < y + 14 * P && (x * 7 + yy * 3) % 29 === 0) col = '#e4e4f0';
      rect(ctx, x, yy, 1, 1, col);
    }
    // Front range: closer, darker, with rock streaks and scree.
    const y2 = Math.round(66 * P + front(x));
    const shaded2 = front(x + 2) > front(x);
    for (let yy = y2; yy < H; yy++) {
      const r = (yy * 3 + x * 5) % 17;
      rect(ctx, x, yy, 1, 1, shaded2 ? (r === 0 ? '#535d84' : '#5e6890') : r === 0 ? '#6a7498' : r === 7 ? '#8088ac' : '#737ea4');
    }
    // Only the highest front peaks keep a little snow.
    if (y2 < 58 * P) rect(ctx, x, y2, 1, 2 * P, '#e8e8f2');
  }
  return c;
}

function ridge(): HTMLCanvasElement {
  const H = 90 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(12);
  const hill = ridgeNoise(rand, [[3, 10], [7, 5], [13, 2], [31, 0.6]]);
  for (let x = 0; x < W; x++) {
    const y = Math.round(46 * P + hill(x));
    for (let yy = y; yy < H; yy++) rect(ctx, x, yy, 1, 1, rand() < 0.25 ? '#b8903a' : rand() < 0.5 ? '#3a564c' : '#46625a');
  }
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const base = Math.round(49 * P + hill(x));
    const h = (6 + rand() * 10) * P;
    const col = rand() < 0.35 ? LARCH : PINE;
    wrapped((dx) => tree(ctx, Math.round(x + dx), base, h, (2 + rand() * 2) * P, col, rng(i + 7)));
  }
  return c;
}

/** A band of mixed forest: dark pines, golden larches and aspens. */
function forest(height: number, seed: number, count: number, minH: number, maxH: number, halfMul: number, gold: number): HTMLCanvasElement {
  const H = height * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(seed);
  for (let x = 0; x < W; x++) {
    for (let y = H - 18 * P; y < H; y++) rect(ctx, x, y, 1, 1, rand() < gold * 0.6 ? '#c8962e' : rand() < 0.5 ? '#2a4236' : '#34503e');
  }
  const trees = Array.from({ length: count }, () => ({ x: Math.round(rand() * W), h: (minH + rand() * (maxH - minH)) * P, kind: rand() }));
  // Tall trees first, so shorter ones in front overlap them.
  trees.sort((a, b) => b.h - a.h);
  trees.forEach((t, i) => {
    const half = t.h * halfMul * (0.8 + rand() * 0.4);
    wrapped((dx) => {
      // Aspen crowns only in the distance; up close they read as blobs.
      if (t.kind < gold * 0.25 && t.h < 100 * P) crown(ctx, t.x + dx, H - 8 * P, t.h * 0.7, ASPEN, rng(seed + i));
      else tree(ctx, t.x + dx, H - 8 * P, t.h, half, t.kind < gold ? LARCH : PINE, rng(seed + i));
    });
  });
  return c;
}

/** Big drifting cumulus clouds: lit tops, lavender undersides, soft edges. */
function clouds(seed: number, count: number, size: number): HTMLCanvasElement {
  const H = 110 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(seed);
  const s = size * P;
  for (let i = 0; i < count; i++) {
    const cx = rand() * W;
    const cy = (30 + rand() * 50) * P;
    const w = s * (0.7 + rand() * 0.6);
    const puffs = Array.from({ length: 11 }, () => ({ x: (rand() - 0.5) * w, y: -rand() * s * 0.35, r: Math.round(s * (0.14 + rand() * 0.16)) }));
    wrapped((dx) => {
      for (const p of puffs) disc(ctx, cx + dx + p.x, cy + p.y + 3 * P, p.r, '#c4b8d8');
      for (const p of puffs) disc(ctx, cx + dx + p.x, cy + p.y + P, p.r, '#d8d0e4');
      for (const p of puffs) disc(ctx, cx + dx + p.x, cy + p.y, p.r, '#ece6ee');
      for (const p of puffs) disc(ctx, cx + dx + p.x - p.r * 0.3, cy + p.y - p.r * 0.35, Math.max(1, Math.round(p.r * 0.55)), '#ffffff');
      rect(ctx, cx + dx - w * 0.35, cy + 3 * P, w * 0.7, P, '#c4b8d8');
    });
  }
  return c;
}

/** Broken horizontal lines that make reflections read as moving water. */
function ripples(): HTMLCanvasElement {
  const H = 60 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(81);
  for (let i = 0; i < 520; i++) {
    const y = Math.floor(rand() * H);
    const w = (3 + Math.floor(rand() * (6 + y * 0.15))) * (rand() < 0.5 ? 1 : P);
    rect(ctx, Math.floor(rand() * W), y, w, 1, rand() < 0.55 ? '#ffffff' : '#000000');
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
  // Branches fanning up into the leaves, forking as they go.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26 * P; i++) rect(ctx, cx + side * (trunkW / 2 + i * 1.3), 56 * P - i, P + 1, P + 1, '#3b2a20');
    for (let i = 0; i < 12 * P; i++) rect(ctx, cx + side * (trunkW / 2 + 14 * P + i * 0.6), 46 * P - i, P, P, '#3b2a20');
  }
  const clumps = (n: number, r0: number, r1: number, yOff: number, color: string, spreadX: number) => {
    for (let k = 0; k < n; k++) {
      const a = leaf() * Math.PI;
      const dist = Math.sqrt(leaf());
      const x = cx + Math.cos(a) * spreadX * P * dist * (leaf() < 0.5 ? -1 : 1);
      const y = (24 - Math.sin(a) * 26 * dist + yOff) * P;
      disc(ctx, x, y, Math.round((r0 + leaf() * (r1 - r0)) * P), color);
    }
  };
  clumps(60, 3, 6, 8, dark, 60);
  clumps(70, 2, 5, 2, mid, 56);
  clumps(55, 1.5, 3, -4, light, 48);
  clumps(30, 0.5, 1.2, -8, glint, 42);
  // Individual leaves: speckle inside and a ragged edge outside.
  for (let k = 0; k < 220; k++) {
    const a = leaf() * Math.PI * 2;
    const d = Math.sqrt(leaf());
    rect(ctx, cx + Math.cos(a) * 62 * P * d, (26 + Math.sin(a) * 30 * d) * P, 2, 2, [dark, mid, light, glint][Math.floor(leaf() * 4)]);
  }
  for (let k = 0; k < 160; k++) {
    const a = leaf() * Math.PI * 2;
    rect(ctx, cx + Math.cos(a) * (55 + leaf() * 14) * P, (26 + Math.sin(a) * (28 + leaf() * 8)) * P, leaf() < 0.5 ? 2 : 1, 1, leaf() < 0.5 ? mid : dark);
  }
}

function nearTrees(): HTMLCanvasElement {
  const H = (GROUND_Y + 6) * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(21);
  let x = 30 * P;
  while (x < W - 20 * P) {
    const w = (8 + Math.round(rand() * 8)) * P;
    const kind = rand();
    const isPine = kind < 0.3;
    const isBirch = kind > 0.72;
    const tx = x;
    wrapped((dx) => {
      const left = tx + dx - w / 2;
      const bark = rng(Math.round(tx));
      if (isBirch) {
        // Birch: white bark with black horizontal marks and a shaded side.
        rect(ctx, left, 0, w, H, '#e8e2d6');
        rect(ctx, left, 0, 3, H, '#f8f4ec');
        rect(ctx, left + w - 4, 0, 4, H, '#b8b0a2');
        for (let y = 0; y < H; y += 5 + Math.round(bark() * 12)) rect(ctx, left + 2 + Math.round(bark() * (w - 8)), y, 3 + Math.round(bark() * 6), 1 + Math.round(bark()), '#2a2622');
      } else {
        // Trunk with deep bark furrows, a lit edge and a shadowed side.
        rect(ctx, left, 0, w, H, isPine ? '#3b2a20' : '#4a3424');
        rect(ctx, left, 0, 3, H, isPine ? '#4d382a' : '#614532');
        rect(ctx, left + 3, 0, 2, H, isPine ? '#443226' : '#563c2a');
        rect(ctx, left + w - 4, 0, 4, H, '#2e2018');
        for (let y = 0; y < H; y += 2 + Math.round(bark() * 5)) {
          const bx = left + 4 + Math.round(bark() * (w - 9));
          rect(ctx, bx, y, 1, 3 + Math.round(bark() * 8), '#2e2018');
          if (bark() < 0.3) rect(ctx, bx + 1, y, 1, 2, isPine ? '#5a4232' : '#6a4c36');
        }
      }
      // Roots flare at the base.
      rect(ctx, left - 3 * P, H - 4 * P, w + 6 * P, 4 * P, isBirch ? '#8a8072' : '#3b2a20');
      rect(ctx, left - 5 * P, H - 2 * P, w + 10 * P, 2 * P, '#33241a');
      if (isPine) {
        // Big soft boughs: rows of rounded clumps, lit on the upper left, shadowed below.
        const bough = rng(Math.round(tx) + 3);
        for (let k = 0; k < 5; k++) {
          const by = (4 + k * 13) * P;
          const reach = w / 2 + (22 - k * 2.5) * P;
          const n = Math.round(reach / (5 * P));
          for (let i = -n; i <= n; i++) {
            const x = tx + dx + (i / n) * reach;
            const r = (4 + bough() * 2) * P;
            const droop = (Math.abs(i) / n) * 4 * P;
            disc(ctx, x, by + droop + 2 * P, r, '#213a2e');
          }
          for (let i = -n; i <= n; i++) {
            const x = tx + dx + (i / n) * reach;
            const r = (4 + bough() * 2) * P;
            const droop = (Math.abs(i) / n) * 4 * P;
            disc(ctx, x, by + droop, r, i > 0 ? '#2d4f3e' : '#3f6a52');
            disc(ctx, x - r * 0.3, by + droop - r * 0.4, Math.round(r * 0.5), i > 0 ? '#3f6a52' : '#5c8a6a');
          }
        }
      } else {
        canopy(ctx, tx + dx, w, rng(Math.round(tx) + 7));
      }
    });
    x += (190 + Math.round(rand() * 170)) * P;
  }
  return c;
}

/** The walkable ground. Starts above the ground line so tufts and rocks can stick up. */
const GROUND_TOP = GROUND_Y - 22;

function ground(): HTMLCanvasElement {
  const H = (VIEW_H - GROUND_TOP) * P;
  const line = (GROUND_Y - GROUND_TOP) * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(31);
  rect(ctx, 0, line, W, H - line, '#5a4030');
  rect(ctx, 0, line, W, 2 * P, '#d8bc5c');
  rect(ctx, 0, line + 2 * P, W, 2 * P, '#b8983e');
  rect(ctx, 0, line + 4 * P, W, P, '#8a7030');
  // Earth darkens toward the bottom of the screen, in dithered steps, with pebbles.
  for (let y = line + 5 * P; y < H; y++) {
    const t = (y - line - 5 * P) / (H - line - 5 * P);
    for (let x = y % 2; x < W; x += 2) {
      if (t > 0.35) rect(ctx, x, y, 1, 1, '#4a3526');
      if (t > 0.7) rect(ctx, x + 1, y, 1, 1, '#3f2d20');
    }
  }
  for (let i = 0; i < 1400; i++) rect(ctx, rand() * W, line + 5 * P + rand() * (H - line), 1, 1, rand() < 0.5 ? '#6b4c36' : '#3a2a1c');
  // Fallen leaves, thickest just below the grass.
  for (let i = 0; i < 2000; i++) {
    const depth = Math.pow(rand(), 2.2);
    const y = line + 5 * P + Math.floor(depth * (H - line - 6 * P));
    const col = LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)];
    ctx.globalAlpha = 1 - depth * 0.6;
    rect(ctx, Math.floor(rand() * W), y, rand() < 0.6 ? 3 : 2, rand() < 0.5 ? 2 : 1, col);
  }
  ctx.globalAlpha = 1;
  // Grass: thin blades in three tones along the edge, plus taller tufts.
  for (let x = 0; x < W; x++) {
    if (rand() < 0.55) {
      const h = 1 + Math.floor(rand() * 4);
      rect(ctx, x, line - h, 1, h, rand() < 0.4 ? '#e8cc6c' : rand() < 0.5 ? '#c8a84a' : '#9a7c34');
    }
  }
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(rand() * W);
    const h = (2 + Math.floor(rand() * 5)) * P;
    wrapped((dx) => {
      for (let b = -2; b <= 2; b++) {
        const bh = h - Math.abs(b) * 2;
        for (let yy = 0; yy < bh; yy++) rect(ctx, x + dx + b + Math.round((b * yy) / bh), line - yy, 1, 1, yy > bh * 0.6 ? '#e8cc6c' : b < 0 ? '#c8a84a' : '#9a7c34');
      }
    });
  }
  // Rocks with a lit top and a cast shadow.
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rand() * W);
    const w = (4 + Math.floor(rand() * 6)) * P;
    wrapped((dx) => {
      rect(ctx, x + dx + 2, line + 1, w, 2, '#3a2a1c');
      rect(ctx, x + dx, line - 3 * P, w, 4 * P, '#7d7a72');
      rect(ctx, x + dx + 2, line - 4 * P, w - 4, P, '#9a978e');
      rect(ctx, x + dx + 2, line - 3 * P, w / 3, 2, '#b4b0a6');
      rect(ctx, x + dx + w - 3, line - 3 * P, 3, 4 * P, '#605d56');
      if (rand() < 0.6) rect(ctx, x + dx + 3, line - 4 * P, w / 2, 2, '#5f7a3a');
    });
  }
  // Mushrooms: red caps with white spots.
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rand() * W);
    wrapped((dx) => {
      rect(ctx, x + dx, line - 3 * P, 2, 3 * P, '#e8dcc0');
      rect(ctx, x + dx - 3, line - 5 * P, 8, 2 * P, '#c0442c');
      rect(ctx, x + dx - 2, line - 5 * P - 1, 6, 1, '#d85a3a');
      rect(ctx, x + dx - 1, line - 5 * P + 1, 1, 1, '#f2e6d0');
      rect(ctx, x + dx + 2, line - 5 * P, 1, 1, '#f2e6d0');
    });
  }
  // A fallen log with bark texture, a cut end with rings, and moss.
  const logX = Math.floor(rand() * W);
  wrapped((dx) => {
    const lx = logX + dx;
    const lw = 46 * P;
    rect(ctx, lx, line - 7 * P, lw, 7 * P, '#5e4330');
    rect(ctx, lx, line - 7 * P, lw, 2 * P, '#7a5a40');
    for (let i = 0; i < lw; i += 3 + Math.floor(rand() * 5)) rect(ctx, lx + i, line - 5 * P + Math.floor(rand() * 6), 2 + Math.floor(rand() * 6), 1, '#4a3424');
    disc(ctx, lx + lw + 2, line - 3.5 * P, 3.5 * P, '#c9a57a');
    disc(ctx, lx + lw + 2, line - 3.5 * P, 2 * P, '#b08a60');
    disc(ctx, lx + lw + 2, line - 3.5 * P, 1, '#8a6a48');
    rect(ctx, lx + 10 * P, line - 8 * P, 8 * P, P, '#4f7a3a');
    rect(ctx, lx + 11 * P, line - 8 * P - 1, 5 * P, 1, '#6a9a4a');
  });
  return c;
}

function foreground(): HTMLCanvasElement {
  const H = 40 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(41);
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rand() * W);
    const big = rand() < 0.4;
    wrapped((dx) => {
      // Bracken: fronds fanning out from the bottom, with leaflets along each stem.
      const fronds = big ? 7 : 4;
      for (let f = 0; f < fronds; f++) {
        const ang = Math.PI * (0.15 + (0.7 * f) / (fronds - 1));
        const len = (big ? 30 : 16) * P * (0.7 + rand() * 0.3);
        const sgn = f % 2 ? 1 : -1;
        for (let s = 0; s < len; s++) {
          const fx = x + dx + Math.cos(ang) * s * sgn * 0.9;
          const fy = H - Math.sin(ang) * s;
          const tip = s > len * 0.7;
          rect(ctx, fx, fy, 2, 2, tip ? '#b8702a' : '#6a3a18');
          if (s % 3 === 0 && s > 4) {
            const leafLen = Math.round((1 - s / len) * 5 * P) + 2;
            for (let l = 1; l < leafLen; l++) {
              rect(ctx, fx + l * 0.7 * sgn, fy - l * 0.5, 1, 1, tip ? '#d08a3a' : '#8a4a20');
              rect(ctx, fx - l * 0.7 * sgn, fy - l * 0.3, 1, 1, tip ? '#b8702a' : '#7a4018');
            }
          }
        }
      }
    });
  }
  return c;
}

/** Cattails and reeds along the shore, in patches so ducks show through the gaps. */
function reeds(): HTMLCanvasElement {
  const H = 56 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(71);
  for (let p = 0; p < 7; p++) {
    const px = rand() * W;
    const width = (20 + rand() * 40) * P;
    for (let i = 0; i < width / 1.5; i++) {
      const x = Math.round(px + (rand() - 0.5) * width);
      const h = (14 + rand() * 34) * P;
      const lean = rand() < 0.5 ? -1 : 1;
      const k2 = 900 * P;
      wrapped((dx) => {
        for (let y = 0; y < h; y++) {
          const sx = x + dx + Math.round((lean * y * y) / k2);
          rect(ctx, sx, H - y, 1, 1, y > h * 0.6 ? '#6b7a3a' : '#4a5a2a');
          if (y % 7 === 0) rect(ctx, sx + 1, H - y, 1, 1, '#8a9a4a');
        }
        const top = x + dx + Math.round((lean * h * h) / k2);
        if (rand() < 0.5) {
          // Cattail head: velvety brown with a lit edge and a thin spike above.
          rect(ctx, top - 1, H - h - 2 * P, 2 * P, 6 * P, '#5a3a22');
          rect(ctx, top - 1, H - h - 2 * P, 1, 6 * P, '#8a5a32');
          rect(ctx, top + 2, H - h - 2 * P, 1, 6 * P, '#3e2616');
          rect(ctx, top, H - h - 5 * P, 1, 3 * P, '#6b7a3a');
        }
        // A long leaf blade arching out.
        if (rand() < 0.45) for (let k = 0; k < 10 * P; k++) rect(ctx, x + dx + lean * k, H - Math.round(h * 0.5) - Math.round(Math.sin((k / (10 * P)) * Math.PI) * 5 * P) + k, 1, 1, '#5d6c34');
      });
    }
  }
  return c;
}

// ---------- Small textures ----------

function sunTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32 * P, 32 * P);
  const m = 16 * P;
  ctx.globalAlpha = 0.1;
  disc(ctx, m, m, 15 * P, '#fff1c8');
  ctx.globalAlpha = 0.18;
  disc(ctx, m, m, 12 * P, '#fff1c8');
  ctx.globalAlpha = 0.32;
  disc(ctx, m, m, 9 * P, '#fff1c8');
  ctx.globalAlpha = 1;
  disc(ctx, m, m, 6 * P, '#fff8e6');
  disc(ctx, m - 2, m - 2, 4 * P, '#fffdf4');
  return c;
}

function moonTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(16 * P, 16 * P);
  const m = 8 * P;
  ctx.globalAlpha = 0.2;
  disc(ctx, m, m, 7 * P, '#dfe6ff');
  ctx.globalAlpha = 1;
  disc(ctx, m, m, 4 * P, '#eef0ff');
  disc(ctx, m - 2, m - 3, 2, '#c8cce6');
  disc(ctx, m + 3, m + 2, 1, '#c8cce6');
  rect(ctx, m + 1, m - 4, 2, 1, '#c8cce6');
  return c;
}

function starsTexture(): HTMLCanvasElement {
  const H = 240 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(51);
  for (let i = 0; i < 800; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    rect(ctx, x, y, 1, 1, rand() < 0.3 ? '#ffffff' : '#9fa8d8');
    if (rand() < 0.04) {
      rect(ctx, x - 2, y, 5, 1, '#c8d0ff');
      rect(ctx, x, y - 2, 1, 5, '#c8d0ff');
    }
  }
  return c;
}

function mistTexture(): HTMLCanvasElement {
  const H = 40 * P;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(61);
  const wave = ridgeNoise(rand, [[3, 4], [7, 2], [17, 1], [37, 0.5]]);
  for (let x = 0; x < W; x++) {
    const top = 14 * P + Math.round(wave(x));
    for (let y = top; y < H; y++) {
      // Stepped opacity: soft, but still made of crisp bands.
      const t = Math.min(1, (y - top) / (14 * P)) * (1 - Math.max(0, (y - 32 * P) / (8 * P)));
      ctx.globalAlpha = Math.round(t * 6) / 6;
      rect(ctx, x, y, 1, 1, '#ffffff');
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

function rayTexture(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(90 * P, 300 * P);
  for (let y = 0; y < 300 * P; y++) {
    const x = Math.round(80 * P - y * 0.25);
    ctx.globalAlpha = 0.5 * (1 - y / (300 * P));
    rect(ctx, x, y, 18 * P, 1, '#ffffff');
  }
  return c;
}

export function createScenery(scene: Phaser.Scene): void {
  const t = scene.textures;
  if (t.exists('bg-mountains')) return;
  t.addCanvas('bg-mountains', mountains());
  t.addCanvas('bg-ridge', ridge());
  t.addCanvas('bg-far', forest(110, 13, 110, 22, 70, 0.3, 0.4));
  t.addCanvas('bg-mid', forest(140, 14, 30, 40, 120, 0.28, 0.38));
  t.addCanvas('bg-big', forest(200, 15, 7, 100, 190, 0.26, 0.35));
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
  for (const [key, rows] of [
    ['bird-up', ['x.......x', '.x.....x.', '..x.x.x..', '...xxx...']],
    ['bird-down', ['...xxx...', '..x.x.x..', '.x.....x.', 'x.......x']],
  ] as const) {
    const [c, ctx] = makeCanvas(9, 4);
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'x' && rect(ctx, x, y, 1, 1, '#2a2630')));
    t.addCanvas(key, c);
  }
}

// ---------- The living backdrop ----------

/** How strongly each far layer (farthest first) fades into the haze. */
const HAZE = [0.6, 0.47, 0.35, 0.23, 0.12];
/** Where the tall near forest's base sits, in world units: just below the ground line. */
const FOREST_BASE = GROUND_Y + 4;

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

/**
 * The sky, scenery, weather and light. Everything here is placed in screen pixels and
 * fixed to the screen; `update` takes the world camera's left edge (in world units) to
 * scroll the layers at their parallax speeds. Objects drawn in front of the characters
 * are listed in `front`, everything else in `back`, so cameras can sort them.
 */
export class Backdrop {
  /** Multiply color for near objects and characters. */
  light = 0xffffff;
  grade: Grade = gradeAt(12);
  /** Behind the characters. */
  readonly back: Phaser.GameObjects.GameObject[] = [];
  /** In front of the characters. */
  readonly front: Phaser.GameObjects.GameObject[] = [];

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
  private flock = false;
  private reflections: [Phaser.GameObjects.TileSprite, number, number][] = [];
  private glints: Glint[] = [];
  private sunGlints: Phaser.GameObjects.Rectangle[] = [];
  /** Where the sky meets the land (or the water, at the lake), in screen pixels. */
  private horizon: number;
  private lastScroll = 0;
  private time = 0;

  constructor(scene: Phaser.Scene, private opts: BackdropOptions) {
    this.horizon = (opts.lake ? LAKE_HORIZON : VIEW_H) * P;
    createScenery(scene);
    this.skyTex = scene.textures.exists('sky')
      ? (scene.textures.get('sky') as Phaser.Textures.CanvasTexture)
      : scene.textures.createCanvas('sky', W, SCREEN_H)!;
    const back = <T extends Phaser.GameObjects.GameObject>(o: T): T => (this.back.push(o), o);
    const front = <T extends Phaser.GameObjects.GameObject>(o: T): T => (this.front.push(o), o);

    back(scene.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-100));
    this.stars = back(scene.add.tileSprite(0, 0, W, 240 * P, 'stars').setOrigin(0).setScrollFactor(0).setDepth(-99));
    this.sun = back(scene.add.image(0, 0, 'sun').setScrollFactor(0).setDepth(-98));
    this.moon = back(scene.add.image(0, 0, 'moon').setScrollFactor(0).setDepth(-98));

    // Layers are given in world units (bottom edge and height) and placed in screen pixels.
    const layer = (key: string, bottom: number, h: number, depth: number) =>
      back(scene.add.tileSprite(0, (bottom - h) * P, W, h * P, key).setOrigin(0).setScrollFactor(0).setDepth(depth));
    // At the lake the far shore sits higher, leaving room for the water below it.
    const lift = opts.lake ? FOREST_BASE - LAKE_HORIZON : 0;
    const farLayers: [string, number, number, number, number][] = [
      ['bg-mountains', FOREST_BASE - 21, 120, -90, 0.04],
      ['bg-ridge', FOREST_BASE - 14, 90, -85, 0.1],
      ['bg-far', FOREST_BASE - 6, 110, -80, 0.2],
      ['bg-mid', FOREST_BASE - 2, 140, -75, 0.35],
      ['bg-big', FOREST_BASE, 200, -70, 0.55],
    ];
    farLayers.forEach(([key, bottom, h, depth, f], i) => {
      // Across open water, the tall near forest is too far away to tower over you.
      if (opts.lake && key === 'bg-big') return;
      this.far.push([layer(key, bottom - lift, h, depth), f, i]);
      // Atmospheric perspective: the farther the layer, the more it fades into the haze.
      this.hazes.push([layer(key, bottom - lift, h, depth + 0.05), f, i]);
      if (opts.lake) {
        // The mirror image: flipped about the horizon, behind a veil of water.
        const r = back(
          scene.add
            .tileSprite(0, (2 * LAKE_HORIZON - (bottom - lift)) * P, W, h * P, key)
            .setOrigin(0)
            .setScrollFactor(0)
            .setFlipY(true)
            .setDepth(-62 + i * 0.1),
        );
        this.reflections.push([r, f, i]);
      }
    });
    this.clouds.push([layer('clouds-far', 130, 110, -97), 0.02, 3]);
    this.clouds.push([layer('clouds-near', 150, 110, -96), 0.05, 6]);
    if (opts.lake) {
      this.ripple = back(
        scene.add
          .tileSprite(0, (LAKE_HORIZON + 2) * P, W, (GROUND_Y - LAKE_HORIZON) * P, 'ripples')
          .setOrigin(0)
          .setScrollFactor(0)
          .setDepth(-57),
      );
    }
    this.mists.push(layer('mist', FOREST_BASE - 12 - lift, 40, -79));
    this.mists.push(layer('mist', FOREST_BASE - lift, 40, -74).setFlipX(true));
    if (opts.lake) this.mists.push(layer('mist', LAKE_HORIZON + 14, 40, -58));

    if (opts.lake) {
      for (let i = 0; i < 60; i++) {
        const obj = back(
          scene.add
            .rectangle(0, (LAKE_HORIZON + 3 + Math.random() * (GROUND_Y - LAKE_HORIZON - 6)) * P, 2 + Math.floor(Math.random() * 14), 1, 0xffffff)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(-56)
            .setBlendMode(Phaser.BlendModes.ADD),
        );
        this.glints.push({ obj, baseX: Math.random() * W, phase: Math.random() * 10 });
      }
      for (let i = 0; i < 28; i++) {
        this.sunGlints.push(back(scene.add.rectangle(0, (LAKE_HORIZON + 2) * P + i * 4, 4, 1, 0xfff0c0).setOrigin(0.5, 0).setScrollFactor(0).setDepth(-55).setBlendMode(Phaser.BlendModes.ADD)));
      }
    }

    for (let i = 0; i < 3; i++) {
      this.rays.push(back(scene.add.image((80 + i * 200) * P, 0, 'ray').setOrigin(0).setScrollFactor(0).setDepth(-65).setBlendMode(Phaser.BlendModes.ADD)));
    }
    if (opts.scrolling && !opts.lake) this.near.push([layer('bg-near', GROUND_Y + 6, GROUND_Y + 6, -60), 0.8]);
    if (opts.lake) this.near.push([layer('bg-reeds', GROUND_Y + 3, 56, -45), 0.9]);
    this.near.push([layer('bg-ground', VIEW_H, VIEW_H - GROUND_TOP, -50), 1]);
    if (opts.scrolling) {
      const fg = scene.add.tileSprite(0, (VIEW_H - 40) * P, W, 40 * P, 'bg-front').setOrigin(0).setScrollFactor(0).setDepth(50);
      this.near.push([front(fg), 1.3]);
    }

    for (let i = 0; i < 30; i++) {
      const obj = front(scene.add.rectangle(Math.random() * W, Math.random() * SCREEN_H, Math.random() < 0.5 ? 3 : 2, 2, Phaser.Display.Color.HexStringToColor(LEAF_COLORS[i % LEAF_COLORS.length]).color));
      obj.setOrigin(0).setScrollFactor(0).setDepth(55);
      this.leaves.push({ obj, vx: 0, vy: (8 + Math.random() * 10) * P, phase: Math.random() * 10 });
    }
    for (let i = 0; i < 26; i++) {
      const obj = front(scene.add.rectangle(Math.random() * W, (GROUND_Y - 100 + Math.random() * 100) * P, 2, 2, 0xfff27a).setOrigin(0).setScrollFactor(0).setDepth(56));
      this.flies.push({ obj, vx: 0, vy: 0, phase: Math.random() * 10 });
    }
    // A small flock, made up front and shown now and then.
    for (let i = 0; i < 5; i++) this.birds.push(back(scene.add.image(-100, 0, 'bird-up').setScrollFactor(0).setDepth(-95).setVisible(false)));
  }

  /** Call every frame. viewLeft is the left edge of the view in world units; windDir is +1 (blowing right) or -1. */
  update(hour: number, viewLeft: number, dt: number, windDir: 1 | -1 = 1): void {
    this.time += dt;
    const scrollX = viewLeft * P;
    const g = gradeAt(hour);
    this.grade = g;
    this.light = g.light;
    const night = Phaser.Math.Clamp(nightness(hour), 0, 1);
    const gold = golden(hour);

    if (Math.abs(hour - this.lastSkyHour) > 0.04) {
      this.drawSky(g);
      this.lastSkyHour = hour;
    }
    this.stars.setAlpha(night);

    // Sun and moon arc across the sky.
    const dayT = (hour - 6.3) / (18.7 - 6.3);
    this.sun.setVisible(dayT > -0.05 && dayT < 1.05);
    const sunBase = this.opts.lake ? LAKE_HORIZON - 10 : GROUND_Y - 22;
    this.sun.setPosition(Math.round((40 + dayT * (VIEW_W - 80)) * P), Math.round((sunBase - Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI) * (sunBase - 50)) * P));
    this.sun.setTint(lerpColor(0xffffff, 0xffa060, gold));
    const nightT = hour > 12 ? (hour - 18.7) / 11 : (hour + 5.3) / 11;
    this.moon.setPosition(Math.round((40 + nightT * (VIEW_W - 80)) * P), Math.round((GROUND_Y - 40 - Math.sin(Math.max(0, Math.min(1, nightT)) * Math.PI) * 140) * P));
    this.moon.setAlpha(night);

    for (const [t, f] of this.far) {
      t.tilePositionX = Math.round(scrollX * f) % W;
      t.setTint(this.light);
    }
    for (const [t, f, i] of this.hazes) {
      t.tilePositionX = Math.round(scrollX * f) % W;
      t.setTintFill(g.layers[i]).setAlpha(HAZE[i] + night * 0.2);
    }
    for (const [t, f, drift] of this.clouds) {
      t.tilePositionX = Math.round(scrollX * f + this.time * drift * P) % W;
      // Clouds take on the sky's color at dawn and dusk.
      t.setTint(lerpColor(this.light, g.skyBottom, 0.3)).setAlpha(1 - night * 0.65);
    }
    for (const [t, f, i] of this.reflections) {
      t.tilePositionX = Math.round(scrollX * f) % W;
      t.setTint(lerpColor(lerpColor(this.light, g.layers[i], HAZE[i]), 0x101820, 0.35)).setAlpha(0.7);
    }
    if (this.ripple) {
      this.ripple.tilePositionX = Math.round(scrollX * 0.6 + this.time * 3 * P) % W;
      this.ripple.setTint(lerpColor(g.skyBottom, 0xffffff, 0.3)).setAlpha(0.16);
    }
    if (this.opts.lake) this.updateWater(scrollX, gold, night);
    this.mists.forEach((m, i) => {
      m.tilePositionX = Math.round(scrollX * (0.25 + i * 0.15) + this.time * (2 + i) * P) % W;
      m.setTint(g.mist).setAlpha(this.opts.lake ? g.mistAlpha * (i === 2 ? 0.35 : 0.6) : g.mistAlpha);
    });
    this.rays.forEach((r, i) => {
      r.setAlpha(gold * (0.35 + Math.sin(this.time * 0.6 + i * 2) * 0.12));
      r.setTint(lerpColor(0xffe0a0, 0xffb070, gold));
      r.x = Math.round((80 + i * 200) * P - ((scrollX * 0.6) % W));
      if (r.x < -100 * P) r.x += W;
    });
    // Near layers pick up a bit of the haze color as well as the light.
    const nearTint = lerpColor(this.light, g.layers[4], 0.12);
    for (const [t, f] of this.near) {
      t.tilePositionX = Math.round(scrollX * f) % W;
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
      let x = (gl.baseX - scrollX * 0.5 + Math.sin(gl.phase) * 4 * P) % W;
      if (x < 0) x += W;
      gl.obj.x = Math.round(x);
      gl.obj.setFillStyle(lerpColor(this.grade.skyBottom, 0xffffff, 0.5));
      gl.obj.setAlpha(Math.max(0, Math.sin(gl.phase * 2.1)) * (0.35 - night * 0.2));
    }
    const sunUp = this.sun.visible && this.sun.y < LAKE_HORIZON * P;
    this.sunGlints.forEach((s, i) => {
      s.x = Math.round(this.sun.x + Math.sin(this.time * 3 + i * 1.7) * (1 + i * 0.6) * P * 0.6);
      s.width = Math.max(1, Math.round((6 - i * 0.15 + Math.sin(this.time * 5 + i) * 2) * P));
      s.setFillStyle(lerpColor(0xfff4d8, 0xffa060, gold));
      s.setAlpha(sunUp ? (0.55 - i * 0.015) * (0.5 + gold * 0.5) * (0.6 + Math.sin(this.time * 4 + i * 2) * 0.4) : 0);
    });
  }

  private drawSky(g: Grade): void {
    const ctx = this.skyTex.getContext();
    const img = ctx.createImageData(W, SCREEN_H);
    const levels = 18;
    const H = this.horizon;
    const lakeBottom = GROUND_Y * P;
    // One color per band; dithering picks between neighboring bands.
    const bands = Array.from({ length: levels + 1 }, (_, i) => lerpColor(g.skyTop, g.skyBottom, i / levels));
    const data = img.data;
    for (let y = 0; y < SCREEN_H; y++) {
      // Below the horizon at the lake, the water mirrors the sky, a little darker.
      const below = y > H;
      const sy = below ? 2 * H - y : y;
      const span = this.opts.lake ? H : SCREEN_H * 0.8;
      const t = Math.min(1, Math.pow(Math.max(0, sy) / span, 1.3)) * levels;
      const frac = (t % 1) * 16;
      const dark = below ? 0.28 + ((y - H) / (lakeBottom - H)) * 0.2 : 0;
      for (let x = 0; x < W; x++) {
        // Ordered dithering between color bands: the classic pixel-art gradient.
        const step = Math.min(levels, Math.floor(t) + (frac > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0));
        const c = below ? lerpColor(bands[step], 0x16222e, dark) : bands[step];
        const o = (y * W + x) * 4;
        data[o] = (c >> 16) & 255;
        data[o + 1] = (c >> 8) & 255;
        data[o + 2] = c & 255;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.skyTex.refresh();
  }

  private updateLeaves(dt: number, scrollDelta: number, windDir: 1 | -1, night: number): void {
    for (const p of this.leaves) {
      p.phase += dt * 2;
      p.obj.x += (windDir * 14 + Math.sin(p.phase) * 10) * P * dt - scrollDelta * 1.1;
      p.obj.y += p.vy * dt;
      if (p.obj.y > SCREEN_H || p.obj.x < -20 || p.obj.x > W + 20) {
        p.obj.y = -8 - Math.random() * 80;
        p.obj.x = Math.random() * W;
      }
      p.obj.setAlpha(1 - night * 0.7);
    }
  }

  private updateFireflies(dt: number, scrollDelta: number, night: number): void {
    const show = night > 0.2 ? night : 0;
    for (const p of this.flies) {
      p.phase += dt;
      p.obj.x += Math.sin(p.phase * 0.7) * 6 * P * dt - scrollDelta * 0.9;
      p.obj.y += Math.cos(p.phase * 0.9) * 4 * P * dt;
      if (p.obj.x < -10) p.obj.x += W + 20;
      if (p.obj.x > W + 10) p.obj.x -= W + 20;
      p.obj.setAlpha(show * Math.max(0, Math.sin(p.phase * 2.3)));
    }
  }

  private updateBirds(dt: number, night: number): void {
    if (!this.flock && night < 0.5 && Math.random() < dt * 0.05) {
      this.flock = true;
      const y = (30 + Math.random() * 60) * P;
      const fromLeft = Math.random() < 0.5;
      this.birds.forEach((b, i) => {
        b.setPosition(fromLeft ? -20 - i * 18 : W + 20 + i * 18, y + (i % 2) * 8 + i * 4).setVisible(true).setData('vx', (fromLeft ? 30 : -30) * P);
      });
    }
    if (!this.flock) return;
    for (const b of this.birds) {
      b.x += (b.getData('vx') as number) * dt;
      b.setTexture(Math.sin(this.time * 12 + b.y) > 0 ? 'bird-up' : 'bird-down');
    }
    if (this.birds.every((b) => b.x < -80 || b.x > W + 80)) {
      this.flock = false;
      this.birds.forEach((b) => b.setVisible(false));
    }
  }
}
