/**
 * On-screen controls for phones and tablets. Hold buttons (walk, hold breath) write to
 * `pad`, which the hunt reads each frame alongside the keyboard; tap buttons call actions.
 */
export const pad = { left: false, right: false, run: false, breath: false };

export function isTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export interface TouchActions {
  aim(): void;
  fire(): void;
  crouch(): void;
  act(): void;
  glass(): void;
  call(): void;
  stand(): void;
  swap(): void;
  camp(): void;
}

const root = () => document.getElementById('touch')!;
let lastAiming: boolean | null = null;

function hold(el: HTMLElement, key: 'left' | 'right' | 'breath'): void {
  const on = (e: PointerEvent) => {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for synthetic pointers; holding still works.
    }
    pad[key] = true;
    el.classList.add('down');
  };
  const off = () => {
    pad[key] = false;
    el.classList.remove('down');
  };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', off);
}

export function showTouch(actions: TouchActions): void {
  const r = root();
  r.innerHTML = `
    <button class="tbtn" id="t-left" aria-label="Walk left">◀</button>
    <button class="tbtn" id="t-right" aria-label="Walk right">▶</button>
    <button class="tbtn small" id="t-run">Run</button>
    <button class="tbtn small" id="t-crouch">Crouch</button>
    <button class="tbtn" id="t-act" aria-label="Tag or pick up">✋</button>
    <button class="tbtn big" id="t-aim">Aim</button>
    <button class="tbtn big fire" id="t-fire">Fire</button>
    <button class="tbtn small" id="t-breath">Hold breath</button>
    <div class="t-row">
      <button class="tbtn mini" data-t="glass">🔭</button>
      <button class="tbtn mini" data-t="call">📯</button>
      <button class="tbtn mini" data-t="stand">🌲</button>
      <button class="tbtn mini" data-t="swap">🔁</button>
      <button class="tbtn mini" data-t="camp" aria-label="Back to camp">⛺</button>
    </div>`;
  r.hidden = false;
  lastAiming = null;
  hold(r.querySelector('#t-left')!, 'left');
  hold(r.querySelector('#t-right')!, 'right');
  hold(r.querySelector('#t-breath')!, 'breath');

  const tap = (sel: string, fn: () => void) =>
    r.querySelector(sel)!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });
  tap('#t-run', () => {
    pad.run = !pad.run;
    r.querySelector('#t-run')!.classList.toggle('on', pad.run);
  });
  tap('#t-crouch', () => {
    actions.crouch();
    r.querySelector('#t-crouch')!.classList.toggle('on');
  });
  tap('#t-act', actions.act);
  tap('#t-aim', actions.aim);
  tap('#t-fire', actions.fire);
  r.querySelectorAll<HTMLElement>('[data-t]').forEach((b) =>
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      actions[b.dataset.t as 'glass' | 'call' | 'stand' | 'swap' | 'camp']();
    }),
  );
}

/** Swap the right-hand buttons between walking and aiming. */
export function setTouchAiming(aiming: boolean): void {
  if (aiming === lastAiming) return;
  lastAiming = aiming;
  const r = root();
  r.classList.toggle('aiming', aiming);
  const aim = r.querySelector('#t-aim');
  if (aim) aim.textContent = aiming ? 'Lower' : 'Aim';
}

export function hideTouch(): void {
  const r = root();
  r.innerHTML = '';
  r.hidden = true;
  r.classList.remove('aiming');
  pad.left = pad.right = pad.run = pad.breath = false;
}
