import Phaser from 'phaser';

/**
 * Everything is drawn on one low-resolution pixel grid (see VIEW_W/VIEW_H) and scaled
 * up by the browser, so characters and scenery share the same pixel size.
 * Hit zones in src/data/animals.ts use these sprite pixel coordinates.
 */
export const SCALE = 1;

type Palette = Record<string, string>;
interface Family {
  frames: Record<string, string[]>;
  palette: Palette;
}

// ---------- Hunter ----------

const HUNTER_TOP = [
  '......oooo........',
  '.....oHHHHo.......',
  '....oHHHHhho......',
  '...oooooooooo.....',
  '.....oSSSSo.......',
  '.....oSSSeo.......',
  '.....osSSSo.......',
  '......oSSo........',
  '....ooVVVVoo......',
  '...oVVVVVVVvo.....',
  '...ojVVVVVVvo.....',
  '...ojVVVVVJJWWGGGG',
  '...ojVVVVVSSWo....',
  '...oVVVVVVVvo.....',
  '...ovVVVVVVvo.....',
];

const HUNTER_LEGS = {
  idle: [
    '....oPPPPPPo......',
    '....oPPppPPo......',
    '....oPPo.oPo......',
    '....oPPo.oPo......',
    '....oPpo.oPo......',
    '....oPpo.oPo......',
    '...oBBBo.oBBo.....',
    '...oBBBBooBBBo....',
  ],
  walk1: [
    '....oPPPPPPo......',
    '....oPPppPPPo.....',
    '...oPPo..oPPo.....',
    '...oPPo...oPPo....',
    '..oPpo....oPPo....',
    '..oPpo.....oPo....',
    '.oBBBo.....oBBo...',
    '.oBBBBo....oBBBo..',
  ],
  walk2: [
    '....oPPPPPPo......',
    '....oPPppPPo......',
    '.....oPPPPo.......',
    '.....oPPPo........',
    '.....oPpPo........',
    '.....oPpPo........',
    '....oBBBBo........',
    '....oBBBBBo.......',
  ],
  crouch: [
    '....oPPPPPPPPo....',
    '...oPPPPPPPPPPo...',
    '...oPppPPoBBBBo...',
    '..oBBBBBo.oBBBBo..',
  ],
};

const HUNTER_FRAMES = Object.fromEntries(Object.entries(HUNTER_LEGS).map(([k, legs]) => [k, [...HUNTER_TOP, ...legs]]));

const HUNTER_BASE: Palette = {
  o: '#1d1612', S: '#e9b88f', s: '#b9875f', e: '#1d1612', j: '#3f4f35', J: '#4f6141',
  W: '#7a4b2a', G: '#3a3a3e', P: '#6b6a4a', p: '#4d4c35', B: '#3b2b1d',
};

// ---------- Animals (all facing right) ----------

const DEER_HEAD_BUCK = [
  '......................A...A.....',
  '....................A.A.A.A..A..',
  '.....................AAAAAAAAA..',
  '......................aA...AA...',
];
const DEER_HEAD_DOE = [
  '................................',
  '................................',
  '................................',
  '................................',
];
const DEER_BODY = [
  '.....................oo.oaao....',
  '.....................oBo.oBBo...',
  '......................oBBBBBBo..',
  '.....................oBBBBeBBBo.',
  '.....................oBBBBBBBBBo',
  '....................oBBBBBBBLnno',
  '....................oBBBbbLLLoo.',
  '...................oBBBbo.ooo...',
  '.....ooooooooooooooBBBbLo.......',
  '...ooBBBBBBBBBBBBBBBBBLLo.......',
  '..oWBBBBBBBBBBBBBBBBBBLLo.......',
  '.oWWBBBBBBBBBBBBBBBBBBBLo.......',
  '.oWBBBBBBBBBBBBBBBBBBBBBo.......',
  '..obBBBBBBBBBBBBBBBBBBBBo.......',
  '..obbBBBBBBBBBBBBBBBBBBbo.......',
  '...obbbLLLLLLLLLLLLLbbbo........',
];
// Does have ears where a buck has antler bases.
const DEER_BODY_DOE = [DEER_BODY[0].replace(/a/g, 'B'), ...DEER_BODY.slice(1)];
const DEER_LEGS = {
  idle: [
    '...obbbo.oLLLLLLLLLo.obBBo......',
    '...oBo.oBo.ooooooooo.oBooBo.....',
    '...oBo.oBo...........oBooBo.....',
    '...olo.olo...........oloolo.....',
    '...olo.olo...........oloolo.....',
    '...oHo.oHo...........oHooHo.....',
  ],
  walk: [
    '...obbbo.oLLLLLLLLLo.obBBo......',
    '....oBooBo.ooooooooo.oBo.oBo....',
    '...oBo..oBo.........oBo...oBo...',
    '..olo....olo.......olo.....olo..',
    '..olo....olo.......olo.....olo..',
    '..oHo....oHo.......oHo.....oHo..',
  ],
};
const DEER_PAL: Palette = {
  o: '#2a1d14', B: '#a07a52', b: '#7a5a3c', L: '#e6d6b8', W: '#f4efe6', A: '#ece0c4', a: '#b8a888',
  e: '#111111', n: '#1a1a1a', H: '#2a1d14', l: '#8a6846',
};

const RABBIT = [
  '........oo.oo.',
  '.......oBpooBo',
  '.......oBpoBo.',
  '......ooBBBBo.',
  '..ooooBBBBeBBo',
  '.oBBBBBBBBBBBn',
  'oWBBBBBBBBBLo.',
  'oWWBBBBBBBLLo.',
  '.obBBBBBBLLo..',
  '..obbbbobbo...',
  '..ooooo.ooo...',
];
const RABBIT_HOP = [
  '.........oo.oo',
  '........oBpooB',
  '.......ooBpoBo',
  '.....oooBBBBo.',
  '..oooBBBBBeBBo',
  '.oBBBBBBBBBBBn',
  'oWBBBBBBBBBLo.',
  'oWWBBBBBBBLLo.',
  '.obBBBBBBLLo..',
  'obbbo..obbo...',
  'ooo.....ooo...',
];

const SQUIRREL = [
  '.ooo...........',
  'oTTTo.....o.o..',
  'oTtTTo...oBoBo.',
  'oTttTo...oBBBBo',
  '.oTtTo..oBBBeBn',
  '..oTTo.oBBBBBo.',
  '..oTtooBBBBLo..',
  '...oTTBBBBBLo..',
  '...oTBBBBBBLo..',
  '....obBBBBLLo..',
  '....obbBoBBo...',
  '....ooooooooo..',
];
const SQUIRREL_HOP = [
  '.ooo...........',
  'oTTTo.....o.o..',
  'oTtTTo...oBoBo.',
  'oTttTo...oBBBBo',
  '.oTtTo..oBBBeBn',
  '..oTTo.oBBBBBo.',
  '..oTtooBBBBLo..',
  '...oTTBBBBBLo..',
  '...oTBBBBBBLo..',
  '...obBBBBBLLo..',
  '..obbo...oBBo..',
  '..ooo.....ooo..',
];

const TURKEY = [
  '..............ooo...',
  '.............oUUeo..',
  '.............oUURRo.',
  '..............oRRor.',
  '..............oRro..',
  '.....ff.......oRo...',
  '...ffFFff....oKKo...',
  '..fFFFFFFf..oKKKo...',
  '.fFFFFFFFFfoKKKKo...',
  '.fFFFFFFFoKKKQKKo...',
  'fFFFFFFFoKKKQQKKdo..',
  'fFFFFFFoKKKKkQKKdo..',
  '.fFFFFoKKKKKkkKKo...',
  '..fFFoKKKKKKKKKKo...',
  '....oKKKKKKKKKKo....',
  '.....ooKKKKKKoo.....',
];
const TURKEY_LEGS = {
  idle: ['.......oolooloo.....', '........l..l........', '........l..l........', '.......ll.ll........'],
  walk: ['.......oolooloo.....', '.......l....l.......', '......l.....l.......', '.....ll....ll.......'],
};
const TURKEY_PAL: Palette = {
  o: '#1a120c', K: '#3a2a1c', k: '#5d4a2e', Q: '#7d7040', F: '#6b4a2a', f: '#d1ad72',
  R: '#d6453d', U: '#7c9be0', r: '#b8302a', e: '#111111', l: '#c27a5a', d: '#120c08',
};

const MALLARD = {
  swim: [
    '..........ooo....',
    '.........oGGGo...',
    '.........oGeGYY..',
    '..........oGGo...',
    '...oooooo.oWo....',
    '.ooBBBBBBooCCo...',
    'oKBBBbbBBBCCCo...',
    'oKKBBBBBBBBCo....',
    '.ooooooooooo.....',
  ],
  up: [
    '....o............',
    '...oBo...........',
    '..oBBo...........',
    '.oBLBo....ooo....',
    'oBBBo....oGGGo...',
    '..oBBBBBBoGeGYY..',
    '.oKBBBBBCCGo.....',
    '..ooooooooo......',
    '.................',
  ],
  down: [
    '..........ooo....',
    '.........oGGGo...',
    '..oooooooGeGYY...',
    '.oKBBBBBCCGo.....',
    '..oBBBBBBoo......',
    '...oBLBo.........',
    '....oBo..........',
    '.....o...........',
    '.................',
  ],
};
const MALLARD_PAL: Palette = {
  o: '#1c1a14', G: '#2f7a46', e: '#111111', Y: '#e6c23e', W: '#f4f1ea', C: '#8a3e22',
  B: '#b4b0a4', b: '#8e8a80', K: '#24221e', L: '#4a62d8',
};

const DOG_TOP = [
  '............oo....',
  '...........oYYo...',
  '..........oYYYYoo.',
  '..........oYeYYYYn',
  '..........oYYYYoo.',
  '..o.......oYrYo...',
  '.oYoooooooYYYYo...',
  '..oYYYYYYYYYYYo...',
  '..oYYYYYYYYYYYo...',
  '..oyYYYYYYYYyyo...',
];
const DOG = {
  idle: [...DOG_TOP, '...oYo.oYo.oYooYo.', '...oYo.oYo.oYooYo.', '...ooo.ooo.oooooo.'],
  run: [...DOG_TOP, '..oYo..oYo..oYo.oYo', '.oYo....oYooYo...oYo', '.ooo.....oooo.....ooo'],
  swim: [...DOG_TOP.slice(0, 7), '.wwYYYYYYYYYYYYww..', 'wwwwwwwwwwwwwwwwwww'],
};
const DOG_PAL: Palette = { o: '#3a2a1a', Y: '#e2c27a', y: '#c09a54', e: '#111111', n: '#1a1a1a', r: '#c0442c', w: '#cfe4f0' };

// The angler: same build as the hunter, rod hand forward, in chest waders.
const ANGLER_TOP = [
  '......oooo........',
  '.....oHHHHo.......',
  '....oHHHHhho......',
  '...oooooooooo.....',
  '.....oSSSSo.......',
  '.....oSSSeo.......',
  '.....osSSSo.......',
  '......oSSo........',
  '....ooVVVVoo......',
  '...oVVkVVkVvo.....',
  '...ojVVVVVVvo.....',
  '...ojVVVVVJJSS....',
  '...ojVVVVVVvo.....',
  '...oPPPPPPPPo.....',
  '...oPPPPPPPPo.....',
];
const ANGLER_FRAMES = Object.fromEntries(Object.entries(HUNTER_LEGS).map(([k, legs]) => [k, [...ANGLER_TOP, ...legs]]));

// Trout, facing left. One shape, three species' colors.
const TROUT = [
  '......oooooo..........',
  '....ooGGGGGGoo.....oo.',
  '..ooGGgGGgGGGGoo..oTTo',
  '.oGGGGGGGgGGGGGGooTTTo',
  'oeGGPPPPPPPPPPGGGTTTTo',
  '.oLLLLLLLLLLLLLLooTTTo',
  '..ooLLLLLLLLLLoo..oTTo',
  '....oooooooooo.....oo.',
];

const SHED = ['A.........', '.AA...A...', '..AAAAA..A', '....aAAAAa', '.......aa.'];

const ICON_ALERT = ['ooooo', 'oYYYo', 'oooYo', '.oYYo', '.ooo.', '.oYo.', '.ooo.'];
const ICON_FLEE = ['.ooo.', '.oRo.', '.oRo.', '.oRo.', '.ooo.', '.oRo.', '.ooo.'];

const FAMILIES: Record<string, Family> = {
  hunter: { frames: HUNTER_FRAMES, palette: { ...HUNTER_BASE, H: '#5b4a32', h: '#3f3322', V: '#6b5a3c', v: '#4f422c' } },
  orange: { frames: HUNTER_FRAMES, palette: { ...HUNTER_BASE, H: '#ff7a1a', h: '#c4520c', V: '#ff7a1a', v: '#c4520c' } },
  buck: {
    frames: { idle: [...DEER_HEAD_BUCK, ...DEER_BODY, ...DEER_LEGS.idle], walk: [...DEER_HEAD_BUCK, ...DEER_BODY, ...DEER_LEGS.walk] },
    palette: DEER_PAL,
  },
  doe: {
    frames: { idle: [...DEER_HEAD_DOE, ...DEER_BODY_DOE, ...DEER_LEGS.idle], walk: [...DEER_HEAD_DOE, ...DEER_BODY_DOE, ...DEER_LEGS.walk] },
    palette: DEER_PAL,
  },
  rabbit: { frames: { idle: RABBIT, walk: RABBIT_HOP }, palette: { o: '#2a1d14', B: '#9b7f62', b: '#7a6048', p: '#d99a9a', W: '#f2efe8', L: '#d8c8b0', n: '#d98080' } },
  squirrel: { frames: { idle: SQUIRREL, walk: SQUIRREL_HOP }, palette: { o: '#1e1e22', T: '#b0b0b0', t: '#8a8a8a', B: '#8a8a8e', b: '#66666a', L: '#ece6da', e: '#111111', n: '#444444' } },
  turkey: { frames: { idle: [...TURKEY, ...TURKEY_LEGS.idle], walk: [...TURKEY, ...TURKEY_LEGS.walk] }, palette: TURKEY_PAL },
  mallard: { frames: MALLARD, palette: MALLARD_PAL },
  angler: { frames: ANGLER_FRAMES, palette: { ...HUNTER_BASE, H: '#b89a6a', h: '#8a7048', V: '#9a9466', v: '#767048', k: '#5a5638', P: '#5e6650', p: '#464c3c' } },
  'trout-rainbow': { frames: { swim: TROUT }, palette: { o: '#1e1e1a', G: '#6e7e48', g: '#1e2418', P: '#e07890', L: '#eeeae0', T: '#6e7e48', e: '#111111' } },
  'trout-brown': { frames: { swim: TROUT }, palette: { o: '#1e1610', G: '#8a6a30', g: '#2a1a10', P: '#c8442c', L: '#ecd490', T: '#8a6a30', e: '#111111' } },
  'trout-brook': { frames: { swim: TROUT }, palette: { o: '#1a1e18', G: '#3e5a3a', g: '#d0c878', P: '#e0503a', L: '#f08a3a', T: '#c84a2a', e: '#111111' } },
  dog: { frames: DOG, palette: DOG_PAL },
  shed: { frames: { idle: SHED }, palette: { A: '#ece0c4', a: '#b8a888' } },
  icon: { frames: { alert: ICON_ALERT, flee: ICON_FLEE }, palette: { o: '#1a120c', Y: '#ffd27a', R: '#ff5a4a' } },
};

/** Texture key for a sprite frame, e.g. frameKey('buck', 'walk'). */
export function frameKey(family: string, frame: string): string {
  return `${family}-${frame}`;
}

function familyWidth(f: Family): number {
  return Math.max(...Object.values(f.frames).flatMap((rows) => rows.map((r) => r.length)));
}

export function pixelCanvas(rows: string[], palette: Palette, width: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

export function createSprites(scene: Phaser.Scene): void {
  if (scene.textures.exists(frameKey('hunter', 'idle'))) return;
  for (const [name, fam] of Object.entries(FAMILIES)) {
    const w = familyWidth(fam);
    for (const [frame, rows] of Object.entries(fam.frames)) {
      scene.textures.addCanvas(frameKey(name, frame), pixelCanvas(rows, fam.palette, w));
    }
  }
}

/** Exposed for tests: sprite size per family. */
export function spriteSize(family: string): { w: number; h: number } {
  const fam = FAMILIES[family];
  return { w: familyWidth(fam), h: Object.values(fam.frames)[0].length };
}
