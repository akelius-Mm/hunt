/**
 * On-screen controls for phones and tablets. Hold buttons (walk) write to `pad`, which
 * the hunt reads each frame alongside the keyboard; tap buttons call actions.
 * Aiming happens on the scene itself: touch and hold to aim, let go to shoot.
 */
export const pad = { left: false, right: false, run: false };

export function isTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export interface TouchActions {
  crouch(): void;
  act(): void;
  glass(): void;
  call(): void;
  stand(): void;
  swap(): void;
  camp(): void;
}

/** Which gear buttons to show: only gear the hunter actually has. */
export interface TouchGear {
  glass: boolean;
  call: boolean;
  stand: boolean;
  swap: boolean;
}

const root = () => document.getElementById('touch')!;
let last = '';

function hold(el: HTMLElement, key: 'left' | 'right'): void {
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

export function showTouch(actions: TouchActions, gear: TouchGear): void {
  const r = root();
  const tool = (key: keyof TouchGear, icon: string, label: string) =>
    gear[key] ? `<button class="tbtn mini" data-t="${key}" aria-label="${label}">${icon}</button>` : '';
  r.innerHTML = `
    <button class="tbtn" id="t-left" aria-label="Walk left">◀</button>
    <button class="tbtn" id="t-right" aria-label="Walk right">▶</button>
    <button class="tbtn small" id="t-run">Run</button>
    <button class="tbtn small" id="t-crouch">Crouch</button>
    <button class="tbtn big" id="t-act" aria-label="Tag or pick up">✋</button>
    <div class="t-row">
      ${tool('glass', '🔭', 'Binoculars')}${tool('call', '📯', 'Use call')}${tool('stand', '🌲', 'Tree stand')}${tool('swap', '🔁', 'Switch weapon')}
      <button class="tbtn mini" data-t="camp" aria-label="Back to camp">⛺</button>
    </div>`;
  r.hidden = false;
  last = '';
  hold(r.querySelector('#t-left')!, 'left');
  hold(r.querySelector('#t-right')!, 'right');

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
  r.querySelectorAll<HTMLElement>('[data-t]').forEach((b) =>
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      actions[b.dataset.t as keyof TouchActions]();
    }),
  );
}

/** While aiming, the controls fade back; ✋ appears only when there's something to do. */
export function setTouchState(aiming: boolean, canAct: boolean): void {
  const key = `${aiming}|${canAct}`;
  if (key === last) return;
  last = key;
  const r = root();
  r.classList.toggle('aiming', aiming);
  r.classList.toggle('can-act', canAct);
}

export function hideTouch(): void {
  const r = root();
  r.innerHTML = '';
  r.hidden = true;
  r.classList.remove('aiming', 'can-act');
  pad.left = pad.right = pad.run = false;
}
