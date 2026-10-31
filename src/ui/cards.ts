import { learn } from '../core/state';
import type { GameState } from '../core/types';
import { lesson } from '../data/lessons';
import { isTouch } from './touch';

const cards = () => document.getElementById('cards')!;

/** One line at the top of the screen for quick updates. A new one replaces the last. */
function toastEl(): HTMLElement {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('aria-live', 'polite');
    document.getElementById('frame')!.append(t);
  }
  return t;
}

let toastTimer = 0;

function toast(html: string, ms = 3500): void {
  const t = toastEl();
  t.innerHTML = html;
  t.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
}

function card(html: string, ms: number): void {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = html;
  el.addEventListener('click', () => el.remove());
  cards().prepend(el);
  // Keep it calm: at most two cards, one on a phone.
  while (cards().children.length > (isTouch() ? 1 : 2)) cards().lastElementChild!.remove();
  window.setTimeout(() => el.remove(), ms);
}

/** Shows a lesson. The first time it's a card saved to the journal; after that, a one-line reminder. */
export function teach(state: GameState, lessonId: string): void {
  const l = lesson(lessonId);
  if (learn(state, lessonId)) {
    card(`<div class="kicker">New lesson</div><h4>${l.title}</h4>${l.text}`, 10000);
  } else {
    toast(`<b>${l.title}.</b> ${l.text.split('. ')[0].replace(/\.$/, '')}.`, 5000);
  }
}

export function note(text: string): void {
  toast(text);
}

export function clearCards(): void {
  cards().innerHTML = '';
  toastEl().classList.remove('show');
}
