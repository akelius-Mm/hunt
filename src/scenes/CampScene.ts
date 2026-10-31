import Phaser from 'phaser';
import { Backdrop } from '../art/backdrop';
import { setupCameras } from '../art/cameras';
import { createSprites, frameKey, spriteImage } from '../art/sprites';
import { GROUND_Y, VIEW_W } from '../art/view';
import { setAmbience, setNight } from '../audio/sound';
import { has } from '../core/state';
import type { GameState } from '../core/types';

/** Golden hour at camp: the coziest light of the day. */
const CAMP_HOUR = 17.9;

type Ctx = CanvasRenderingContext2D;

function r(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** The cabin, tent and fire pit. Lit by the scene light. */
/** The camp art is drawn for a 480-wide frame; in the wider view it shifts right, toward the trees. */
const CAMP_X = 150;

function campCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = GROUND_Y + 2;
  const ctx = c.getContext('2d')!;
  const g = GROUND_Y;

  // Cabin: stacked logs.
  const cx = 290, cw = 120, ch = 54;
  for (let y = 0; y < ch; y += 6) {
    r(ctx, cx, g - ch + y, cw, 6, y % 12 ? '#6b4a30' : '#5e4129');
    r(ctx, cx, g - ch + y + 5, cw, 1, '#3b2618');
    r(ctx, cx - 3, g - ch + y + 1, 4, 4, '#8a6544');
    r(ctx, cx + cw - 1, g - ch + y + 1, 4, 4, '#8a6544');
  }
  // Roof with shingle rows.
  for (let y = 0; y < 30; y++) {
    const half = Math.round(8 + y * 2.3);
    const ry = g - ch - 30 + y;
    r(ctx, cx + cw / 2 - half, ry, half * 2, 1, y % 4 === 3 ? '#2a1d16' : '#4a342a');
  }
  r(ctx, cx - 10, g - ch - 1, cw + 20, 2, '#2a1d16');
  // Chimney.
  r(ctx, cx + 88, g - ch - 38, 12, 22, '#7d7a72');
  for (let y = 0; y < 22; y += 4) r(ctx, cx + 88 + ((y / 4) % 2) * 3, g - ch - 38 + y, 6, 1, '#5d5a54');
  // Door, windows (dark here; their glow is drawn separately) and a sign.
  r(ctx, cx + 52, g - 30, 16, 30, '#3b2618');
  r(ctx, cx + 54, g - 28, 12, 28, '#5a3a22');
  r(ctx, cx + 63, g - 15, 2, 2, '#e8c04a');
  for (const wx of [cx + 14, cx + 86]) {
    r(ctx, wx - 1, g - 37, 22, 18, '#3b2618');
  }
  r(ctx, cx + 36, g - ch + 3, 48, 9, '#c9a57a');
  r(ctx, cx + 36, g - ch + 11, 48, 1, '#8a6a48');
  // Tiny antler logo on the sign.
  for (const [x, y] of [[0, 3], [1, 2], [2, 1], [2, 3], [3, 0], [4, 2], [5, 1], [6, 3]]) r(ctx, cx + 56 + x, g - ch + 4 + y, 1, 1, '#5a3a22');
  // Porch steps.
  r(ctx, cx + 48, g - 2, 24, 2, '#8a6544');

  // Trader's canvas tent.
  const tx = 425;
  for (let y = 0; y < 40; y++) {
    const half = Math.round(y * 0.9);
    r(ctx, tx - half, g - 40 + y, half * 2 + 1, 1, y % 6 === 5 ? '#9a8558' : '#b8a070');
    r(ctx, tx, g - 40 + y, half + 1, 1, y % 6 === 5 ? '#7d6b45' : '#9a8558');
  }
  for (let y = 0; y < 22; y++) r(ctx, tx - Math.round(y * 0.4), g - 22 + y, Math.round(y * 0.8) + 1, 1, '#3a2c1c');
  r(ctx, tx, g - 46, 1, 6, '#5a4630');
  r(ctx, tx + 1, g - 46, 6, 3, '#c0442c');
  // Crates by the tent.
  r(ctx, 452, g - 10, 14, 10, '#8a6544');
  r(ctx, 452, g - 10, 14, 1, '#a58060');
  r(ctx, 452, g - 5, 14, 1, '#5e4129');

  // Fire pit: stones and logs.
  for (let i = 0; i < 7; i++) r(ctx, 238 + i * 4, g - 2 - (i % 2), 4, 3, i % 2 ? '#7d7a72' : '#9a978e');
  r(ctx, 244, g - 5, 16, 3, '#5e4330');
  r(ctx, 246, g - 7, 3, 3, '#5e4330');
  r(ctx, 256, g - 7, 3, 3, '#4a3424');
  // A stump to sit on.
  r(ctx, 212, g - 7, 10, 7, '#6b4a30');
  r(ctx, 212, g - 8, 10, 2, '#c9a57a');
  return c;
}

const FLAMES = [
  ['...y...', '..yYy..', '..YOY..', '.yOROy.', '.YORRY.', 'yORRROy', '.ORRRO.'],
  ['..y....', '..Yy...', '.yYOy..', '.YORO..', '.YORRY.', 'yORRROy', '.ORRRO.'],
  ['....y..', '...yY..', '..yOYy.', '..YORY.', '.YORRY.', 'yORRROy', '.ORRRO.'],
];

export class CampScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private flames: Phaser.GameObjects.Image[] = [];
  private glow!: Phaser.GameObjects.Arc;
  private camp!: Phaser.GameObjects.Image;
  private hunter!: Phaser.GameObjects.Image;
  private smoke: Phaser.GameObjects.Rectangle[] = [];
  private t = 0;

  private state: GameState | null = null;

  init(data: { state?: GameState }): void {
    this.flames = [];
    this.smoke = [];
    this.state = data?.state ?? null;
  }

  constructor() {
    super('camp');
  }

  create(): void {
    createSprites(this);
    this.backdrop = new Backdrop(this, { scrolling: false });
    setAmbience('camp');
    setNight(0);
    setupCameras(this, this.backdrop).follow(VIEW_W / 2, VIEW_W, 1);
    if (!this.textures.exists('camp')) {
      // Drawn in world units, like the sprites.
      this.textures.addCanvas('camp', campCanvas());
      const pal: Record<string, string> = { y: '#ffe08a', Y: '#ffc04a', O: '#ff8a2a', R: '#e0482a' };
      FLAMES.forEach((rows, i) => {
        const c = document.createElement('canvas');
        c.width = 7;
        c.height = 7;
        const ctx = c.getContext('2d')!;
        rows.forEach((row, y) => [...row].forEach((ch, x) => pal[ch] && r(ctx, x, y, 1, 1, pal[ch])));
        this.textures.addCanvas(`flame-${i}`, c);
      });
    }
    this.camp = spriteImage(this, CAMP_X, 0, 'camp').setOrigin(0).setDepth(-40);

    // Warm window light and firelight are not darkened by the scene light.
    for (const wx of [CAMP_X + 304, CAMP_X + 376]) {
      this.add.rectangle(wx, GROUND_Y - 36, 20, 16, 0xffc86a).setOrigin(0).setDepth(-39);
      this.add.rectangle(wx + 9, GROUND_Y - 36, 2, 16, 0x3b2618).setOrigin(0).setDepth(-39);
      this.add.rectangle(wx, GROUND_Y - 29, 20, 2, 0x3b2618).setOrigin(0).setDepth(-39);
    }
    this.glow = this.add.circle(CAMP_X + 252, GROUND_Y - 6, 40, 0xff9a40, 0.18).setDepth(-38).setBlendMode(Phaser.BlendModes.ADD);
    this.flames = [248, 253, 257].map((x) => spriteImage(this, CAMP_X + x, GROUND_Y - 4, 'flame-0').setOrigin(0.5, 1).setDepth(-37));

    const state = this.state;
    this.hunter = spriteImage(this, CAMP_X + 224, GROUND_Y, frameKey(state && has(state, 'orange-vest') ? 'orange' : 'hunter', 'idle')).setOrigin(0.5, 1).setDepth(-36);
    if (state) this.addTrophies(state);
    for (let i = 0; i < 8; i++) {
      this.smoke.push(this.add.rectangle(CAMP_X + 384, GROUND_Y - 92 - i * 8, 3, 3, 0xd8d0c8, 0.5).setDepth(-41));
    }
  }

  /** What you've done shows at camp: antlers over the door, a trout on the wall, a rod by the porch. */
  private addTrophies(state: GameState): void {
    const g = this.add.graphics().setDepth(-39);
    const cx = CAMP_X + 290;
    const y = GROUND_Y;
    if (state.harvests.some((h) => h.animal === 'buck')) {
      g.fillStyle(0xe8dcc0, 1);
      for (const [dx, dy] of [[0, 3], [1, 2], [2, 1], [2, 3], [3, 0], [4, 2], [5, 1], [6, 3], [7, 2], [8, 1], [8, 3], [9, 2], [10, 3]]) g.fillRect(cx + 55 + dx, y - 40 + dy, 1, 1);
      g.fillStyle(0x3b2618, 1).fillRect(cx + 59, y - 36, 3, 2);
    }
    if ((state.fishLog ?? []).some((c) => !c.released)) {
      g.fillStyle(0x5e4129, 1).fillRect(cx + 26, y - 26, 16, 6);
      g.fillStyle(0x7a8a6a, 1).fillRect(cx + 28, y - 25, 11, 3);
      g.fillStyle(0xd8c8a0, 1).fillRect(cx + 29, y - 23, 9, 1);
      g.fillStyle(0x7a8a6a, 1).fillRect(cx + 39, y - 26, 2, 5);
    }
    if (has(state, 'fly-rod')) {
      g.lineStyle(1, 0x3a2a1a, 1).lineBetween(cx + 76, y, cx + 79, y - 36);
      g.fillStyle(0x8a6a48, 1).fillRect(cx + 76, y - 8, 1, 6);
    }
    if (has(state, 'tree-stand')) {
      g.fillStyle(0x2b2b2b, 1).fillRect(cx + 104, y - 10, 10, 1).fillRect(cx + 104, y - 10, 1, 10).fillRect(cx + 113, y - 10, 1, 10);
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.t += dt;
    this.backdrop.update(CAMP_HOUR, 0, dt);
    this.camp.setTint(this.backdrop.light);
    this.hunter.setTint(this.backdrop.light);
    this.flames.forEach((f, i) => f.setTexture(`flame-${(Math.floor(this.t * 8) + i) % 3}`));
    this.glow.setAlpha(0.15 + Math.sin(this.t * 13) * 0.03 + Math.sin(this.t * 7) * 0.03);
    this.smoke.forEach((s, i) => {
      const life = (this.t * 0.25 + i / this.smoke.length) % 1;
      s.setPosition(Math.round(CAMP_X + 384 + Math.sin(life * 6 + i) * 3 + life * 14), Math.round(GROUND_Y - 92 - life * 70));
      s.setAlpha(0.45 * (1 - life));
      s.setSize(2 + Math.round(life * 4), 2 + Math.round(life * 4)).setOrigin(0.5);
    });
  }
}
