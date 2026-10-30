import Phaser from 'phaser';

/** Every sprite pixel is drawn as a SCALE x SCALE block. Hit zones use unscaled pixels. */
export const SCALE = 4;

type Palette = Record<string, string>;

const PLAYER = [
  '....hhh.....',
  '...hhhhh....',
  '..hhhhhhhh..',
  '....sssk....',
  '....ssss....',
  '...vvvvv....',
  '..vvvvvvgggg',
  '..vvvvvvss..',
  '..vvvvvv....',
  '...vvvvv....',
  '...pppp.....',
  '...pppp.....',
  '...pp.pp....',
  '...pp.pp....',
  '...pp.pp....',
  '..ooo.ooo...',
];

const RABBIT = [
  '........ee..',
  '........ee..',
  '.......bbbb.',
  '..bbbbbbbbkb',
  '.bbbbbbbbbb.',
  'wbbbbbbbbb..',
  '.bbbbbbbb...',
  '..bb...bb...',
];

const SQUIRREL = [
  'tt.........',
  'ttt....e...',
  'tttt..bbbb.',
  '.ttt.bbbkbn',
  '..tt.bbbbb.',
  '..ttbbbbb..',
  '...tbbbbb..',
  '....bbbbb..',
  '....b...b..',
];

const TURKEY = [
  '..........rr..',
  '..........rkB.',
  '..........rr..',
  '...........r..',
  '..t........nn.',
  '.ttt......nnn.',
  'ttttt.bbbbbn..',
  'tttttbbbbbbb..',
  '.tttbbbbbbbb..',
  '..ttbbbbbbbb..',
  '....bbbbbbb...',
  '.....bbbbb....',
  '......l..l....',
  '......l..l....',
  '.....ll.ll....',
];

const DEER_BODY = [
  '...................hhhh.',
  '...................hhkhh',
  '...................hhhhn',
  '..................hhh...',
  '....bbbbbbbbbbbbbbhh....',
  '..wbbbbbbbbbbbbbbbbb....',
  '..wbbbbbbbbbbbbbbbbb....',
  '...bbbbbbbbbbbbbbbbb....',
  '...bbbbbbbbbbbbbbbbb....',
  '....lllllllllllllll.....',
  '....l.l.........l.l.....',
  '....l.l.........l.l.....',
  '....l.l.........l.l.....',
  '....d.d.........d.d.....',
];

const BUCK = ['....................a.a.', '...................aa.aa', '....................aaa.', ...DEER_BODY];
const DOE = ['........................', '...................e..e.', '...................ee.e.', ...DEER_BODY];

const SHED = ['a.......', '.aa..a..', '..aaaa..', '....aaaa'];

const DEER_PAL: Palette = { a: '#eadcbf', h: '#8b6a45', k: '#111111', n: '#222222', b: '#93704a', w: '#f4f1ea', l: '#c9b08a', d: '#2b2018', e: '#7e5f3d' };

const SPRITES: Record<string, [string[], Palette]> = {
  hunter: [PLAYER, { h: '#4b5d3a', s: '#e0b48c', k: '#222222', v: '#6b5a3c', g: '#3a3a3a', p: '#5f6b44', o: '#3b2b1d' }],
  'hunter-orange': [PLAYER, { h: '#ff7a1a', s: '#e0b48c', k: '#222222', v: '#ff7a1a', g: '#3a3a3a', p: '#5f6b44', o: '#3b2b1d' }],
  rabbit: [RABBIT, { e: '#8a6f55', b: '#9b7f62', k: '#1a1a1a', w: '#f2efe8' }],
  squirrel: [SQUIRREL, { t: '#9a9a9a', e: '#777777', b: '#7b7b7b', k: '#111111', n: '#555555' }],
  turkey: [TURKEY, { r: '#d6453d', k: '#111111', B: '#5b7fd1', n: '#3b2a1f', t: '#7a5230', b: '#2f241b', l: '#d08a6a' }],
  buck: [BUCK, DEER_PAL],
  doe: [DOE, DEER_PAL],
  shed: [SHED, { a: '#eadcbf' }],
};

function pixelCanvas(rows: string[], palette: Palette, scale: number): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = rows.length * scale;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return canvas;
}

/** Deterministic random numbers, so scenery looks the same every run. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export const LAYER_W = 960;

function pine(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, color: string) {
  const w = h * 0.4;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const top = baseY - h + (i * h) / 5;
    const bottom = top + h / 2.2;
    const half = (w / 2) * (0.5 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x - half, bottom);
    ctx.lineTo(x + half, bottom);
    ctx.fill();
  }
  ctx.fillRect(x - 2, baseY - h * 0.15, 4, h * 0.15);
}

function oak(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, trunk: string, leaves: string) {
  ctx.fillStyle = trunk;
  ctx.fillRect(x - 6, baseY - h * 0.6, 12, h * 0.6);
  ctx.fillStyle = leaves;
  for (const [dx, dy, r] of [[0, -0.75, 0.28], [-0.2, -0.6, 0.22], [0.2, -0.62, 0.22], [0, -0.55, 0.2]]) {
    ctx.beginPath();
    ctx.arc(x + dx * h, baseY + dy * h, r * h, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws a tileable layer: anything crossing the right edge is drawn again on the left. */
function layer(height: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void, seed: number) {
  const canvas = document.createElement('canvas');
  canvas.width = LAYER_W;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const offset of [0, -LAYER_W]) {
    ctx.save();
    ctx.translate(offset, 0);
    draw(ctx, seeded(seed));
    ctx.restore();
  }
  return canvas;
}

export function createTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('hunter')) return;
  for (const [key, [rows, pal]] of Object.entries(SPRITES)) {
    scene.textures.addCanvas(key, pixelCanvas(rows, pal, SCALE));
  }

  scene.textures.addCanvas(
    'hills',
    layer(220, (ctx) => {
      ctx.fillStyle = '#5d7a8c';
      ctx.beginPath();
      ctx.moveTo(0, 220);
      for (let x = 0; x <= LAYER_W; x += 8) {
        const y = 110 + Math.sin((x / LAYER_W) * Math.PI * 4) * 30 + Math.sin((x / LAYER_W) * Math.PI * 10) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(LAYER_W, 220);
      ctx.fill();
    }, 1),
  );

  scene.textures.addCanvas(
    'far-trees',
    layer(260, (ctx, rand) => {
      for (let x = 10; x < LAYER_W + 40; x += 22 + rand() * 18) pine(ctx, x, 260, 120 + rand() * 90, '#36574a');
    }, 2),
  );

  scene.textures.addCanvas(
    'mid-trees',
    layer(340, (ctx, rand) => {
      for (let x = 30; x < LAYER_W + 80; x += 90 + rand() * 80) {
        if (rand() < 0.5) pine(ctx, x, 340, 220 + rand() * 100, '#24402f');
        else oak(ctx, x, 340, 230 + rand() * 80, '#3b2b1d', '#2f5233');
      }
    }, 3),
  );

  scene.textures.addCanvas(
    'ground',
    layer(140, (ctx, rand) => {
      ctx.fillStyle = '#4a5e2c';
      ctx.fillRect(0, 0, LAYER_W, 140);
      ctx.fillStyle = '#5c4630';
      ctx.fillRect(0, 30, LAYER_W, 110);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = rand() < 0.5 ? '#6b8a3a' : '#3d5124';
        ctx.fillRect(Math.floor(rand() * LAYER_W), Math.floor(rand() * 34), 4, 4 + Math.floor(rand() * 8));
      }
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = ['#a0522d', '#c27a2c', '#7a4b2a'][Math.floor(rand() * 3)];
        ctx.fillRect(Math.floor(rand() * LAYER_W), 34 + Math.floor(rand() * 100), 6, 4);
      }
    }, 4),
  );

  scene.textures.addCanvas(
    'bushes',
    layer(90, (ctx, rand) => {
      for (let x = 60; x < LAYER_W + 60; x += 160 + rand() * 200) {
        ctx.fillStyle = '#1f3a24';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(x + (i - 2) * 18, 70 - rand() * 20, 22 + rand() * 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, 5),
  );
}
