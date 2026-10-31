import Phaser from 'phaser';
import { nextDay } from './core/economy';
import { clearSave, load, newGame, save } from './core/state';
import { SCREEN_H, SCREEN_W } from './art/view';
import { CampScene } from './scenes/CampScene';
import { FishScene, type FishSummary } from './scenes/FishScene';
import { HuntScene, type HuntSummary } from './scenes/HuntScene';
import { clearCards, teach } from './ui/cards';
import { clearUi, showCamp, showFishSummary, showHaul, type CampActions } from './ui/menus';
import './style.css';

let state = load() ?? newGame();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W,
  height: SCREEN_H,
  pixelArt: true,
  backgroundColor: '#12160f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [CampScene, HuntScene, FishScene],
});

const actions: CampActions = {
  hunt(areaId) {
    clearUi();
    game.scene.stop('camp');
    game.scene.start('hunt', { state, areaId, onEnd: endHunt });
  },
  fish() {
    clearUi();
    game.scene.stop('camp');
    game.scene.start('fish', { state, onEnd: endFishing });
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
  game.scene.stop('fish');
  game.scene.start('camp');
  showCamp(state, actions);
}

function endFishing(s: FishSummary): void {
  nextDay(state);
  save(state);
  goCamp();
  showFishSummary(state, s, () => {
    save(state);
    showCamp(state, actions);
  });
}

function endHunt(s: HuntSummary): void {
  nextDay(state);
  save(state);
  goCamp();
  showHaul(state, s, () => {
    save(state);
    showCamp(state, actions);
  });
}

goCamp();
if (!state.lessons.includes('welcome')) teach(state, 'welcome');

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { game, getState: () => state });

// Installed on a home screen, the game works offline. Hosts without a service worker
// file (like an embedded preview) simply skip this.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
