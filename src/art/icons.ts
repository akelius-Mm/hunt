/**
 * Pixel-art icons for every item, used by the store, the haul screen and the trader.
 * Each icon is a small pixel map; some share a shape and swap colors.
 */

type Palette = Record<string, string>;

const BASE: Palette = {
  k: '#1e1612', W: '#a06a3a', w: '#6a4024', M: '#5a5a64', m: '#9a9aa6', Y: '#e8c050', y: '#b08a30',
  R: '#c8442c', r: '#8a2a1e', O: '#ff8a2a', o: '#c45a14', G: '#4f7a3e', g: '#34502a', P: '#f0e6cc',
  p: '#c8b894', B: '#4a6ad8', S: '#cfcfd6', s: '#8e8e9a', T: '#a0784e', t: '#6a4a30', F: '#eadcc0',
  L: '#2e2e36', E: '#7ab0e0', A: '#ece0c4', a: '#b8a888',
};

const CARD = [
  '..............',
  'kkkkkkkkkkkkkk',
  'kPPPPPPPPPPPPk',
  'kPGGGPPppppPPk',
  'kPGFGPPPPPPPPk',
  'kPGGGPPppppPPk',
  'kPPPPPPPPPPPPk',
  'kPppppppppppPk',
  'kPPPPPPPPPPPPk',
  'kkkkkkkkkkkkkk',
];

const TAG = [
  '.....kk.....',
  '....k..k....',
  '...kkkkkk...',
  '..kOOOOOOk..',
  '..kOOkkOOk..',
  '..kOOOOOOk..',
  '..kOPPPPOk..',
  '..kOOOOOOk..',
  '..kOPPPPOk..',
  '..kOOOOOOk..',
  '..kooooook..',
  '...kkkkkk...',
];

const STAMP = [
  'k.k.k.k.k.k.k.',
  '.PPPPPPPPPPPP.',
  'kPBBBBBBBBBBPk',
  '.PBBBBBBBGGBP.',
  'kPBBkkkkkGYBPk',
  '.PBkTTTTTkBBP.',
  'kPBBkkkkkBBBPk',
  '.PEEEEEEEEEEP.',
  'kPPPPPPPPPPPPk',
  '.k.k.k.k.k.k..',
];

const RIFLE = [
  '................',
  '......kk........',
  'kkkkkkMMkkkkkkkk',
  'wWWWWWWMMMMMMMMk',
  'kwWWWkkkkkkkkkkk',
  '..kwWk..........',
  '...kk...........',
];

const SCOPED = [
  '.....kkkkkk.....',
  '.....kmmmmk.....',
  'kkkkkkkkkkkkkkkk',
  'wWWWWWMMMMMMMMMk',
  'kwWWWkkMkkkkkkkk',
  '..kwWk.k........',
  '...kk...........',
];

const SHOTGUN = [
  '................',
  'kkkkkkkkkkkkkkkk',
  'wWWWWWMMMMMMMMMk',
  'kwWWWWMMMMMMMMMk',
  '..kwWkkkWWWWkkkk',
  '...kk..kkkkk....',
];

const BOW = [
  '...kk.....',
  '..kMMk....',
  '.kMk.ks...',
  '.kMk..s...',
  'kMk...s...',
  'kWWk..s...',
  'kWWkssssRR',
  'kWWk..s...',
  'kMk...s...',
  '.kMk..s...',
  '.kMk.ks...',
  '..kMMk....',
  '...kk.....',
];

const AMMO = [
  '.kkkkkkkkkkkk.',
  '.kYkYkYkYkYkk.',
  'kkkkkkkkkkkkkk',
  'kCCCCCCCCCCCCk',
  'kCPPPPPPPPPPCk',
  'kCPkkPkkPkkPCk',
  'kCPPPPPPPPPPCk',
  'kCCCCCCCCCCCCk',
  'kcccccccccccck',
  'kkkkkkkkkkkkkk',
];

const ARROWS = [
  '..........kk',
  '.........kmk',
  '........kmk.',
  '.......kWk..',
  '......kWk...',
  '.....kWk....',
  '....kWk.....',
  '..RkWk......',
  '.RRWk.......',
  'RRRk........',
  '.R..........',
];

const KNIFE = [
  '..........kk',
  '.........kSk',
  '........kSsk',
  '.......kSsk.',
  '......kSsk..',
  '.....kSsk...',
  '....kkkk....',
  '...kWwk.....',
  '..kWwk......',
  '.kWwk.......',
  'kkkk........',
];

const VEST = [
  '..kkk....kkk..',
  '.kOOOk..kOOOk.',
  '.kOOOOkkOOOOk.',
  'kOOOOOkkOOOOOk',
  'kOOOOOkkOOOOOk',
  'kOSSSOkkOSSSOk',
  'kOOOOOkkOOOOOk',
  'kOOOOOkkOOOOOk',
  'koooookkoooook',
  'kkkkkkkkkkkkkk',
];

const BINOCULARS = [
  '.kkk....kkk.',
  'kLLLk..kLLLk',
  'kLLLkkkkLLLk',
  'kLLLkMMkLLLk',
  'kLLLkkkkLLLk',
  'kLLLk..kLLLk',
  'kEEEk..kEEEk',
  '.kkk....kkk.',
];

const CAN = [
  '...kk...',
  '..kMMk..',
  '..kkkk..',
  '.kGGGGk.',
  '.kGPPGk.',
  '.kGPPGk.',
  '.kGGGGk.',
  '.kGGGGk.',
  '.kggggk.',
  '..kkkk..',
];

const TUBE_CALL = [
  '..............',
  'kkkkkkkkkkkk..',
  'kWWWWWWWWkMk..',
  'kwwwwwwwwkMMkk',
  'kkkkkkkkkkkkk.',
];

const BOX_CALL = [
  '.kkkkkkkkkkkk.',
  'kWWWWWWWWWWWWk',
  'kwwwwwwwwwwwwk',
  '.kkkkkkkkkkkk.',
  '.kTTTTTTTTTTk.',
  '.kTttttttttTk.',
  '.kkkkkkkkkkkk.',
];

const HARNESS = [
  'kk........kk',
  'kOk......kOk',
  '.kOk....kOk.',
  '..kOk..kOk..',
  '...kOkkOk...',
  '....kMMk....',
  '....kMMk....',
  '...kOkkOk...',
  '..kOk..kOk..',
  '.kOk....kOk.',
  'kOk......kOk',
  'kk........kk',
];

const STAND = [
  'kkkkkkkk.....',
  'kMMMMMMk.....',
  'kkkkkkkk.....',
  '..kMk........',
  '..kMk........',
  'kkkMkkkkkkkk.',
  'kMMMMMMMMMMk.',
  'kkkkkkkkkkkk.',
  '..kMk...kMk..',
  '..kMk..kMk...',
];

const WADERS = [
  'kk.......kk',
  'kGk.....kGk',
  'kGGkkkkkGGk',
  'kGGGGGGGGGk',
  'kGGGkkkGGGk',
  'kGGGk.kGGGk',
  'kGGGk.kGGGk',
  'kgggk.kgggk',
  'kLLLLkLLLLk',
  'kkkkkkkkkkk',
];

const DECOY = [
  '..........kkk...',
  '.........kGGGk..',
  '.........kGkGYY.',
  '..........kGGk..',
  '...kkkkkk.kPk...',
  '.kkSSSSSSkkTTk..',
  'kLSSSsSSSSTTTk..',
  'kLLSSSSSSSSTk...',
  '.kkkkkkkkkkk....',
];

const FEATHER = [
  '.........kk',
  '........kFk',
  '.......kFTk',
  '......kFTk.',
  '.....kFTTk.',
  '....kFTTk..',
  '...kTTTk...',
  '..kTTk.....',
  '.kTk.......',
  'kk.........',
];

const PELT = [
  '..kk......kk..',
  '.kTTk....kTTk.',
  '..kTTkkkkTTk..',
  '...kTTFFTTk...',
  '...kTFFFFTk...',
  '...kTFFFFTk...',
  '...kTFFFFTk...',
  '..kTTFFFFTTk..',
  '.kTTk.kk.kTTk.',
  '..kk......kk..',
];

const TAIL = [
  '......kkk.....',
  '....kkSSSk....',
  '...kSSssSSk...',
  '..kSsSSSSsk...',
  '..kSSSkkSSk...',
  '...kkk.kSSk...',
  '......kSSk....',
  '.....kSSk.....',
  '....kSsk......',
  '...kkk........',
];

const ANTLERS = [
  'k.....k.....k',
  'Ak...kAk...kA',
  '.Ak.kA.Ak.kA.',
  '..AAA...AAA..',
  '...kAAkAAk...',
  '....kAAAk....',
  '.....kAk.....',
];

const SHED = [
  'A..........',
  '.Ak....A...',
  '..AAAAAAk.A',
  '....kAAAAAk',
  '........aa.',
];

const ROD = [
  '...........k',
  '..........k.',
  '.........k..',
  '........k...',
  '.......k....',
  '......k.....',
  '.....W......',
  '....WW......',
  '..MMW.......',
  '..MmM.......',
  '.WW.........',
  'W...........',
];

const NET = [
  '..kkkkk.....',
  '.kW.W.Wk....',
  'kW.W.W.Wk...',
  'k.W.W.W.k...',
  'kW.W.W.Wk...',
  '.kW.W.Wk....',
  '..kkkkkWW...',
  '.......WW...',
  '........WW..',
  '.........WW.',
];

const DRY_MAYFLY = [
  '.....PP.....',
  '.....PP.....',
  '...TTPPTT...',
  '..T.TssT.T..',
  '.....ss.....',
  '....sss.....',
  '...sss......',
  '..sss.......',
  '.kk.........',
  'k...........',
];

const DRY_CADDIS = [
  '............',
  '....TTTTTT..',
  '..TTTTTTTTT.',
  '.TTTTTTTTTkk',
  '..ssssssk...',
  '...kk.......',
];

const NYMPH = [
  '........YY..',
  '.......YYY..',
  '....TTTTk...',
  '..TTyTTyk...',
  '.TtTTtTk....',
  'tt..........',
];

const STREAMER = [
  '..........kk',
  '........GGGk',
  '....LLGGgGG.',
  'LLLLLLGGGG..',
  '.LLLLLGGg...',
  'LLL.........',
];

const ICONS: Record<string, [string[], Palette?]> = {
  'fishing-license': [CARD, { G: '#4a6ad8', F: '#cfe4f0' }],
  'trout-stamp': [STAMP, { B: '#4f7a3e', E: '#6aa0d8', T: '#e07890' }],
  'fly-rod': [ROD],
  'landing-net': [NET, { W: '#3a3a42' }],
  'fly-adams': [DRY_MAYFLY],
  'fly-caddis': [DRY_CADDIS, { T: '#c8a870' }],
  'fly-nymph': [NYMPH, { T: '#8a5a30', t: '#5a3a1e', y: '#c8783a' }],
  'fly-streamer': [STREAMER],
  'hunting-license': [CARD],
  'turkey-tag': [TAG, { O: '#d84a3a', o: '#9a2a1e' }],
  'deer-tag': [TAG],
  'duck-stamp': [STAMP],
  'rifle-22': [RIFLE],
  'shotgun-20': [SHOTGUN],
  'rifle-308': [SCOPED],
  bow: [BOW],
  'ammo-22': [AMMO, { C: '#4f7a3e', c: '#34502a' }],
  'ammo-turkey': [AMMO, { C: '#c8442c', c: '#8a2a1e', Y: '#d84a3a' }],
  'ammo-steel': [AMMO, { C: '#4a6ad8', c: '#2e4290', Y: '#cfcfd6' }],
  'ammo-308': [AMMO, { C: '#3a3a42', c: '#24242a' }],
  'arrows-broadhead': [ARROWS],
  knife: [KNIFE],
  'orange-vest': [VEST],
  binoculars: [BINOCULARS],
  'scent-spray': [CAN],
  'grunt-call': [TUBE_CALL],
  'duck-call': [TUBE_CALL, { W: '#3a3a42', w: '#24242a' }],
  'box-call': [BOX_CALL],
  harness: [HARNESS],
  'tree-stand': [STAND],
  waders: [WADERS],
  decoys: [DECOY],
  'squirrel-tail': [TAIL],
  'rabbit-pelt': [PELT, { T: '#9b7f62', F: '#e8dcc8' }],
  'turkey-feathers': [FEATHER, { F: '#d1ad72', T: '#4a3424' }],
  'duck-feathers': [FEATHER, { F: '#cfcfd6', T: '#4a62d8' }],
  'deer-hide': [PELT],
  antlers: [ANTLERS],
  'shed-antler': [SHED],
};

const cache = new Map<string, string>();

/** A data URL of the item's icon, drawn one canvas pixel per icon pixel. */
export function iconUrl(itemId: string): string {
  const hit = cache.get(itemId);
  if (hit) return hit;
  const [rows, swap] = ICONS[itemId] ?? [CARD];
  const pal = { ...BASE, ...swap };
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  // Center every icon in the same 16x16 square, so tiles line up.
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  const ox = Math.floor((16 - w) / 2);
  const oy = Math.floor((16 - rows.length) / 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!pal[ch]) return;
    ctx.fillStyle = pal[ch];
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }));
  const url = c.toDataURL();
  cache.set(itemId, url);
  return url;
}

/** An <img> tag for an item's icon. */
export function iconImg(itemId: string, cls = 'icon'): string {
  return `<img class="${cls}" src="${iconUrl(itemId)}" alt="" width="16" height="16">`;
}
