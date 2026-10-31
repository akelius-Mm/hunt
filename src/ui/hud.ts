import { VIEW_H, VIEW_W } from '../art/view';

/** The hunt HUD is HTML laid over the canvas, so text stays sharp at any size. */
export interface HudData {
  time: string;
  legal: boolean;
  wind: 1 | -1;
  weapon: string;
  tags: string;
  stance: string;
  /** 0..1 while aiming, otherwise null. */
  breath: number | null;
  hint: string;
}

export interface Label {
  /** Screen position in game pixels. */
  x: number;
  y: number;
  title: string;
  detail: string;
  ok: boolean;
}

const hud = () => document.getElementById('hud')!;
const labels = () => document.getElementById('labels')!;
let lastHud = '';
let lastLabels = '';

export function setHud(d: HudData): void {
  const html = `
    <div class="hud-box">
      <div><b>${d.time}</b> <span class="${d.legal ? 'right' : 'wrong'}">● ${d.legal ? 'legal light' : 'no shooting'}</span> <span class="muted">· wind ${d.wind === 1 ? '→' : '←'}</span></div>
      <div class="muted">${d.weapon}${d.tags ? ` · ${d.tags}` : ''}${d.stance ? ` · ${d.stance}` : ''}</div>
    </div>
    ${d.breath !== null ? `<div class="breath"><div style="width:${Math.round(d.breath * 100)}%" class="${d.breath > 0.2 ? '' : 'low'}"></div></div>` : ''}
    <div class="hud-hint">${d.hint}</div>`;
  if (html !== lastHud) {
    hud().innerHTML = html;
    lastHud = html;
  }
}

export function setLabels(list: Label[]): void {
  const html = list
    .map(
      (l) =>
        `<div class="glass-label ${l.ok ? 'ok' : ''}" style="left:${((l.x / VIEW_W) * 100).toFixed(2)}%;top:${((l.y / VIEW_H) * 100).toFixed(2)}%">
          <b>${l.title}</b><br>${l.detail}</div>`,
    )
    .join('');
  if (html !== lastLabels) {
    labels().innerHTML = html;
    lastLabels = html;
  }
}

export function clearHud(): void {
  hud().innerHTML = '';
  labels().innerHTML = '';
  lastHud = '';
  lastLabels = '';
}
