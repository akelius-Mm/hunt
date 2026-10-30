import Phaser from 'phaser';
import { nextDay } from './core/economy';
import { clearSave, load, newGame, save } from './core/state';
import { TRADER_NAME } from './core/trade';
import { item } from './data/items';
import { VIEW_H, VIEW_W } from './art/view';
import { CampScene } from './scenes/CampScene';
import { HuntScene, type HuntSummary } from './scenes/HuntScene';
import { clearCards, teach } from './ui/cards';
import { clearUi, showCamp, showSummary, type CampActions } from './ui/menus';
import './style.css';

let state = load() ?? newGame();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  pixelArt: true,
  backgroundColor: '#12160f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [CampScene, HuntScene],
});

const actions: CampActions = {
  hunt(areaId) {
    clearUi();
    game.scene.stop('camp');
    game.scene.start('hunt', { state, areaId, onEnd: endHunt });
  },
  save: () => save(state),
  reset() {
    clearSave();
    state = newGame();
    clearCards();
    goCamp();
    teach(state, 'welcome');
  },
};

function goCamp(): void {
  game.scene.stop('hunt');
  game.scene.start('camp');
  showCamp(state, actions);
}

function endHunt(s: HuntSummary): void {
  nextDay(state);
  save(state);
  goCamp();
  const items = Object.entries(s.items).map(([id, q]) => `${item(id).name} ×${q}`);
  showSummary(
    [
      `<b>${s.areaName}</b>`,
      s.harvested.length ? `Harvested: ${s.harvested.join(', ')}` : 'No harvest today. Every hunt teaches something.',
      items.length ? `Brought back: ${items.join(', ')}` : '',
      s.meatLbs ? `Meat in the freezer: +${s.meatLbs} lbs` : '',
      s.fines ? `<span class="wrong">Fines paid: $${s.fines}</span>` : '',
      `New lessons: ${s.newLessons}`,
      `It is now day ${state.day}. Shop prices have recovered a little, and ${TRADER_NAME} has new stock.`,
    ].filter(Boolean),
    () => showCamp(state, actions),
  );
}

goCamp();
if (!state.lessons.includes('welcome')) teach(state, 'welcome');

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { game, getState: () => state });
