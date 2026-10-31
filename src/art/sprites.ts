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

// ---------- People ----------
// The hunter and the angler share one build, 20x30, lit from the left. Outfits are
// palette swaps. Weapons and the fly rod are drawn by the scenes, in the hand at HAND.

/** The hand holding the gun or rod, in sprite pixels (standing and crouched alike). */
export const HAND = { x: 18, y: 17 };

const PERSON_TOP = [
  '.......ooooo........',
  '......oIHHHHo.......',
  '.....oIHHHHHho......',
  '....obbbbbbbbbo.....',
  '..ooIIHHHHHHHHhoo...',
  '...oohhhhhhhhhhoo...',
  '.....orSSSSSSsso....',
  '.....orSSSSeSSSo....',
  '.....orSSSSSSSSo....',
  '.....orrSSSSSsso....',
  '......orBBBBBBo.....',
  '......oosssssoo.....',
  '....ooWVRRRRRVvoo...',
  '...oWWVkVRRRVkVvvo..',
  '...oWVVVVRRRVVVVvo..',
  '...oWVkkVRRRVkkVvo..',
  '..oRWVVVVRRRVVVVvRo.',
  '..oRWVVVVVVVVVVvoSSo',
  '..orLLLLLLYLLLLLlo..',
];

const PERSON_LEGS = {
  idle: [
    '...oQPPPPPPPPPPpo...',
    '...oQPPPPPPPPPPpo...',
    '...oQPPPPppPPPPpo...',
    '...oQPPPo..oQPPpo...',
    '...oQPPPo..oQPPpo...',
    '...oQPPpo..oQPPpo...',
    '...oQPPpo..oQPPpo...',
    '...oQPPpo..oQPPpo...',
    '...oXxXXo..oXxXXo...',
    '..oXxXXXXooXxXXXXo..',
    '..ooooooooooooooooo.',
  ],
  walk1: [
    '...oQPPPPPPPPPPpo...',
    '...oQPPPPPPPPPPPpo..',
    '..oQPPPppo.oQPPPpo..',
    '..oQPPPo....oQPPpo..',
    '.oQPPpo.....oQPPpo..',
    '.oQPPpo......oQPpo..',
    'oQPPpo.......oQPPpo.',
    'oQPPpo.......oQPPpo.',
    'oXxXXo.......oXxXXo.',
    'XxXXXXo......oXxXXXo',
    'ooooooo......ooooooo',
  ],
  walk2: [
    '...oQPPPPPPPPPPpo...',
    '...oQPPPPPPPPPpo....',
    '....oQPPPPPPPpo.....',
    '.....oQPPPPPpo......',
    '.....oQPPPPPpo......',
    '.....oQPPpPPpo......',
    '.....oQPPpPPpo......',
    '.....oQPPpPPpo......',
    '.....oXxXXXXXo......',
    '....oXxXXXXXXXo.....',
    '....ooooooooooo.....',
  ],
  crouch: [
    '...oQPPPPPPPPPPPPPo.',
    '..oQPPPPPPPPPPPPPPpo',
    '..oQPPppPPPoXxXXXXo.',
    '.oXxXXXXXooXxXXXXXXo',
    '.ooooooooooooooooooo',
  ],
};

const PERSON_FRAMES = Object.fromEntries(Object.entries(PERSON_LEGS).map(([k, l]) => [k, [...PERSON_TOP, ...l]]));

const PERSON_BASE: Palette = {
  o: '#2a1e16', S: '#e8b48a', s: '#c08a62', e: '#2a1e16', r: '#5a3a22', B: '#7a5236', R: '#a8402c',
  L: '#3a2a1a', Y: '#d8b050', l: '#2a1e12', P: '#7a7a52', p: '#5a5a3a', Q: '#949468', X: '#4a3424', x: '#6a4a30',
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
  hunter: { frames: PERSON_FRAMES, palette: { ...PERSON_BASE, H: '#6b5838', h: '#4e3f28', I: '#8a7450', b: '#3a2e1e', V: '#7a6440', v: '#5a4a2e', W: '#9a8256', k: '#4a3c24' } },
  orange: { frames: PERSON_FRAMES, palette: { ...PERSON_BASE, H: '#ff7a1a', h: '#c4520c', I: '#ffa050', b: '#2a1e16', V: '#ff7a1a', v: '#c4520c', W: '#ffa050', k: '#a8400a' } },
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
  angler: {
    frames: PERSON_FRAMES,
    palette: {
      ...PERSON_BASE, H: '#b89a6a', h: '#8a7048', I: '#d4b886', b: '#5a4a30', V: '#9a9466', v: '#767048', W: '#b8b282', k: '#5a5638',
      R: '#5a7aa0', P: '#5e6650', p: '#464c3c', Q: '#76806a', L: '#464c3c', Y: '#464c3c', l: '#3a3e30', X: '#3a3a32', x: '#55554a',
    },
  },
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
