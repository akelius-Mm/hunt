/**
 * The inside of Trailhead Outfitters, drawn pixel by pixel: Mae behind the counter,
 * a window onto the golden woods, a gun rack, a mounted buck and shelves of gear.
 */

export const STORE_W = 200;
export const STORE_H = 120;

type Ctx = CanvasRenderingContext2D;

function r(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function disc(ctx: Ctx, cx: number, cy: number, rad: number, c: string): void {
  ctx.fillStyle = c;
  for (let y = -rad; y <= rad; y++) {
    const half = Math.floor(Math.sqrt(rad * rad - y * y));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

function walls(ctx: Ctx): void {
  // Pine plank wall, warm in the lamplight.
  for (let x = 0; x < STORE_W; x += 9) {
    r(ctx, x, 0, 9, STORE_H, x % 18 ? '#6e4a2c' : '#77502f');
    r(ctx, x, 0, 1, STORE_H, '#4a3020');
    for (let y = 6 + (x % 5) * 3; y < 90; y += 23) r(ctx, x + 4, y, 2, 1, '#4f3422');
  }
  // Ceiling beam.
  r(ctx, 0, 0, STORE_W, 7, '#3e2818');
  r(ctx, 0, 6, STORE_W, 1, '#2a1a10');
}

function windowView(ctx: Ctx): void {
  const x = 10, y = 14, w = 46, h = 36;
  r(ctx, x - 3, y - 3, w + 6, h + 6, '#3a2616');
  // Sky and golden trees outside.
  for (let i = 0; i < h; i++) r(ctx, x, y + i, w, 1, i < 14 ? '#8fb8e0' : i < 20 ? '#c8d8e4' : '#f0dca8');
  r(ctx, x + 4, y + 8, 14, 3, '#f4f2f8');
  r(ctx, x + 8, y + 6, 8, 2, '#f4f2f8');
  for (const [tx, th, col] of [[x + 5, 18, '#e2ae44'], [x + 14, 24, '#2c4a3c'], [x + 24, 20, '#f0c454'], [x + 34, 26, '#e2ae44'], [x + 42, 16, '#2c4a3c']] as const) {
    for (let k = 0; k < th; k++) {
      const half = Math.round((k / th) * 5);
      r(ctx, tx - half, y + h - th + k, half * 2 + 1, 1, col);
    }
  }
  r(ctx, x, y + h - 3, w, 3, '#c8a84a');
  // Window frame cross.
  r(ctx, x + w / 2 - 1, y, 2, h, '#3a2616');
  r(ctx, x, y + h / 2 - 1, w, 2, '#3a2616');
  r(ctx, x - 4, y + h + 3, w + 8, 3, '#8a6040');
}

function gunRack(ctx: Ctx): void {
  r(ctx, 64, 12, 36, 4, '#4a3020');
  r(ctx, 64, 62, 36, 4, '#4a3020');
  for (let i = 0; i < 3; i++) {
    const gx = 70 + i * 11;
    r(ctx, gx, 14, 2, 30, '#3a3a42');
    r(ctx, gx - 1, 44, 4, 16, i === 1 ? '#8a5a30' : '#a06a3a');
    r(ctx, gx - 1, 44, 1, 16, '#6a4024');
    if (i === 2) r(ctx, gx - 1, 26, 4, 6, '#24242a');
  }
}

function trophy(ctx: Ctx): void {
  // A mounted whitetail on a plaque, high on the wall.
  r(ctx, 150, 10, 18, 22, '#5a3a22');
  r(ctx, 151, 11, 16, 20, '#7a5232');
  r(ctx, 154, 14, 10, 14, '#a07a52');
  r(ctx, 156, 26, 6, 4, '#a07a52');
  r(ctx, 157, 28, 4, 2, '#1a1a1a');
  r(ctx, 155, 18, 2, 2, '#111111');
  r(ctx, 161, 18, 2, 2, '#111111');
  for (const s of [-1, 1]) {
    const bx = s < 0 ? 153 : 165;
    for (let k = 0; k < 9; k++) r(ctx, bx + s * Math.round(k / 2), 13 - k, 1, 1, '#ece0c4');
    r(ctx, bx + s * 2, 7, 1, 3, '#ece0c4');
    r(ctx, bx + s * 4, 5, 1, 3, '#ece0c4');
  }
}

function shelves(ctx: Ctx): void {
  const colors = ['#4f7a3e', '#c8442c', '#4a6ad8', '#3a3a42', '#e8c050', '#ff8a2a'];
  for (let s = 0; s < 3; s++) {
    const y = 40 + s * 15;
    r(ctx, 172, y + 10, 28, 2, '#4a3020');
    for (let b = 0; b < 4; b++) {
      const c = colors[(s * 4 + b) % colors.length];
      r(ctx, 174 + b * 6, y + 3, 5, 7, c);
      r(ctx, 174 + b * 6, y + 5, 5, 2, '#f0e6cc');
    }
  }
  // A coil of rope and a lantern on hooks.
  disc(ctx, 182, 30, 4, '#c8a870');
  disc(ctx, 182, 30, 2, '#7a5a3a');
}

function lamp(ctx: Ctx): void {
  r(ctx, 128, 7, 1, 8, '#2a1a10');
  r(ctx, 123, 15, 11, 3, '#3a3a42');
  ctx.globalAlpha = 0.18;
  disc(ctx, 128, 26, 26, '#ffd890');
  ctx.globalAlpha = 0.18;
  disc(ctx, 128, 24, 14, '#ffe8b0');
  ctx.globalAlpha = 1;
  r(ctx, 126, 18, 5, 2, '#fff2c0');
}

function mae(ctx: Ctx, blink: boolean): void {
  const cx = 128;
  // Hair, with a bun on top.
  disc(ctx, cx, 47, 13, '#7a3418');
  disc(ctx, cx, 32, 6, '#7a3418');
  disc(ctx, cx - 2, 30, 2, '#9a4a24');
  // Face.
  r(ctx, cx - 8, 40, 17, 20, '#e9b88f');
  r(ctx, cx + 6, 40, 3, 20, '#c9966c');
  r(ctx, cx - 7, 59, 15, 2, '#c9966c');
  // Fringe and side locks.
  r(ctx, cx - 9, 37, 19, 5, '#8a3a1e');
  r(ctx, cx - 6, 41, 4, 1, '#8a3a1e');
  r(ctx, cx - 11, 40, 3, 20, '#7a3418');
  r(ctx, cx + 9, 40, 3, 20, '#7a3418');
  // Eyes, brows, cheeks and a smile.
  if (blink) {
    r(ctx, cx - 5, 49, 3, 1, '#2a1d14');
    r(ctx, cx + 2, 49, 3, 1, '#2a1d14');
  } else {
    r(ctx, cx - 5, 48, 2, 2, '#2a1d14');
    r(ctx, cx + 3, 48, 2, 2, '#2a1d14');
    r(ctx, cx - 5, 48, 1, 1, '#ffffff');
    r(ctx, cx + 3, 48, 1, 1, '#ffffff');
  }
  r(ctx, cx - 6, 46, 4, 1, '#5a2410');
  r(ctx, cx + 2, 46, 4, 1, '#5a2410');
  r(ctx, cx - 6, 52, 2, 1, '#e08a7a');
  r(ctx, cx + 5, 52, 2, 1, '#e08a7a');
  r(ctx, cx, 50, 1, 3, '#c9966c');
  r(ctx, cx - 2, 55, 5, 1, '#8a3a2a');
  r(ctx, cx - 3, 54, 1, 1, '#8a3a2a');
  r(ctx, cx + 3, 54, 1, 1, '#8a3a2a');
  // Neck, flannel shirt with plaid, and a green work vest with a name tag.
  r(ctx, cx - 3, 60, 7, 4, '#c9966c');
  r(ctx, cx - 18, 63, 37, 26, '#b8442c');
  for (let x = cx - 18; x < cx + 19; x += 5) r(ctx, x, 63, 1, 26, '#8a2a1e');
  for (let y = 66; y < 89; y += 5) r(ctx, cx - 18, y, 37, 1, '#8a2a1e');
  r(ctx, cx - 4, 63, 9, 3, '#e9b88f');
  r(ctx, cx - 11, 66, 8, 23, '#4f6141');
  r(ctx, cx + 4, 66, 8, 23, '#4f6141');
  r(ctx, cx + 5, 71, 6, 3, '#f0e6cc');
  r(ctx, cx + 6, 72, 4, 1, '#4f6141');
  // Arms resting on the counter.
  r(ctx, cx - 26, 80, 12, 9, '#b8442c');
  r(ctx, cx + 15, 80, 12, 9, '#b8442c');
  r(ctx, cx - 20, 86, 7, 3, '#e9b88f');
  r(ctx, cx + 14, 86, 7, 3, '#e9b88f');
}

function counter(ctx: Ctx): void {
  r(ctx, 0, 88, STORE_W, 32, '#7a5232');
  r(ctx, 0, 86, STORE_W, 3, '#c0905e');
  r(ctx, 0, 89, STORE_W, 1, '#5a3a22');
  for (let x = 6; x < STORE_W; x += 32) {
    r(ctx, x, 94, 26, 20, '#6a4428');
    r(ctx, x, 94, 26, 1, '#8a6040');
  }
  // Brass register and a jar of lures on the counter.
  r(ctx, 160, 74, 20, 12, '#c09a40');
  r(ctx, 162, 70, 16, 5, '#a08030');
  r(ctx, 163, 77, 14, 3, '#2a1d14');
  r(ctx, 164, 78, 3, 1, '#9ad870');
  r(ctx, 82, 76, 9, 10, '#cfe4f0');
  r(ctx, 82, 75, 9, 2, '#8a6040');
  r(ctx, 84, 80, 2, 2, '#ff8a2a');
  r(ctx, 87, 82, 2, 2, '#e8c050');
  r(ctx, 85, 83, 1, 1, '#4a6ad8');
}

/** Draws the whole store. Call again with blink=true for a moment to make Mae blink. */
export function drawStore(canvas: HTMLCanvasElement, blink = false): void {
  canvas.width = STORE_W;
  canvas.height = STORE_H;
  const ctx = canvas.getContext('2d')!;
  walls(ctx);
  windowView(ctx);
  gunRack(ctx);
  trophy(ctx);
  shelves(ctx);
  lamp(ctx);
  mae(ctx, blink);
  counter(ctx);
}
