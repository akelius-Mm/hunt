import { learn } from '../core/state';
import type { GameState } from '../core/types';
import { lesson } from '../data/lessons';

const cards = () => document.getElementById('cards')!;

function show(html: string, cls: string, ms: number): void {
  const el = document.createElement('div');
  el.className = `card ${cls}`;
  el.innerHTML = html;
  el.addEventListener('click', () => el.remove());
  cards().prepend(el);
  while (cards().children.length > 4) cards().lastElementChild!.remove();
  window.setTimeout(() => el.remove(), ms);
}

/** Shows a lesson. The first time, it's a big card saved to the journal; after that, a short reminder. */
export function teach(state: GameState, lessonId: string): void {
  const l = lesson(lessonId);
  if (learn(state, lessonId)) {
    show(`<div class="kicker">New lesson · saved to journal</div><h4>${l.title}</h4>${l.text}`, '', 12000);
  } else {
    show(`<h4>${l.title}</h4>${l.text}`, 'small', 5000);
  }
}

export function note(text: string): void {
  show(text, 'small', 4000);
}

export function clearCards(): void {
  cards().innerHTML = '';
}
