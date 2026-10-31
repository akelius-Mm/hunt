/**
 * On-screen controls for phones and tablets: only the gear row and the ✋ action button.
 * Moving, aiming and crouching happen on the scene itself with one finger (see gestures.ts).
 * `pad` is kept for gamepad-style input; nothing on screen writes to it now.
 */
export const pad = { left: false, right: false, run: false };

export function isTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export interface TouchActions {
  /** Fishing: tie on the next fly. */
  flybox?(): void;
  act(): void;
  glass(): void;
  call(): void;
  stand(): void;
  swap(): void;
  camp(): void;
}

/** Which gear buttons to show: only gear the hunter actually has. */
export interface TouchGear {
  flybox?: boolean;
  glass: boolean;
  call: boolean;
  stand: boolean;
  swap: boolean;
}

const root = () => document.getElementById('touch')!;
let last = '';

export function showTouch(actions: TouchActions, gear: TouchGear): void {
  const r = root();
  const tool = (key: keyof TouchGear, icon: string, label: string) =>
    gear[key] ? `<button class="tbtn mini" data-t="${key}" aria-label="${label}">${icon}</button>` : '';
  r.innerHTML = `
    <button class="tbtn big" id="t-act" aria-label="Tag or pick up">✋</button>
    <div class="t-row">
      ${tool('flybox', '🪰', 'Change fly')}${tool('glass', '🔭', 'Binoculars')}${tool('call', '📯', 'Use call')}${tool('stand', '🌲', 'Tree stand')}${tool('swap', '🔁', 'Switch weapon')}
      <button class="tbtn mini" data-t="camp" aria-label="Back to camp">⛺</button>
    </div>`;
  r.hidden = false;
  last = '';
  r.querySelector('#t-act')!.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    actions.act();
  });
  r.querySelectorAll<HTMLElement>('[data-t]').forEach((b) =>
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      actions[b.dataset.t as keyof TouchActions]?.();
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
