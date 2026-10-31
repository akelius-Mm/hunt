import { buy, buyPrice, canBuy, demandOf, discount, donateMeat, sell, sellPrice } from '../core/economy';
import { count, has } from '../core/state';
import {
  canBorrowDog,
  DOG_TRUST,
  evaluateTrade,
  executeTrade,
  TRADER_GOODS,
  TRADER_NAME,
  TRADER_WANTS,
  traderMargin,
  type Basket,
} from '../core/trade';
import type { GameState, ItemCategory } from '../core/types';
import type { FishSummary } from '../scenes/FishScene';
import type { HuntSummary } from '../scenes/HuntScene';
import { ANIMALS, AREAS } from '../data/animals';
import { FISH, FLIES } from '../data/fish';
import { ITEMS, item } from '../data/items';
import { LESSONS, PASS_SCORE, QUIZ } from '../data/lessons';
import { teach } from './cards';
import { isTouch } from './touch';
import { iconImg } from '../art/icons';
import { drawStore } from '../art/storefront';

const ui = () => document.getElementById('ui')!;

/** Rounds in stock for every ammo type a weapon can fire. */
function ammoCount(state: GameState, weaponId: string): number {
  return item(weaponId).weapon!.ammo.reduce((n, a) => n + count(state, a), 0);
}

export interface CampActions {
  hunt(areaId: string): void;
  fish(): void;
  save(): void;
  reset(): void;
}

export function clearUi(): void {
  ui().innerHTML = '';
}

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function on(root: HTMLElement, selector: string, fn: (target: HTMLElement) => void): void {
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest(selector) as HTMLElement | null;
    if (t && root.contains(t) && !(t as HTMLButtonElement).disabled) fn(t);
  });
}

export function showCamp(state: GameState, actions: CampActions): void {
  clearUi();
  const weapon = state.equippedWeapon ? item(state.equippedWeapon).name : 'No weapon';
  const top = el(`
    <div class="camp-top">
      <div class="camp-title">Base Camp</div>
      <div class="camp-stats">Day ${state.day} · <span class="money">$${state.money}</span> · ${weapon}</div>
      <div class="camp-hint">${nextStep(state)}</div>
    </div>`);
  const dock = el(`
    <nav class="camp-dock" aria-label="Camp">
      <button class="primary" data-a="hunt">Go hunting</button>
      <button class="primary" data-a="fish">Go fishing</button>
      <button data-a="shop">Outfitters</button>
      <button data-a="trader">Hollis</button>
      <button data-a="journal">Journal</button>
      <button data-a="ed">Hunter ed${state.hunterEd ? ' ✓' : ''}</button>
      <button data-a="freezer">Freezer</button>
    </nav>`);
  const refresh = () => {
    actions.save();
    showCamp(state, actions);
  };
  on(dock, '[data-a]', (t) => {
    switch (t.dataset.a) {
      case 'hunt': return openAreaSelect(state, actions);
      case 'fish': return openRiver(state, actions);
      case 'shop': return openShop(state, refresh);
      case 'trader': return openTrader(state, refresh);
      case 'journal': return openJournal(state, refresh, 'gear', actions.reset);
      case 'ed': return openHunterEd(state, refresh);
      case 'freezer': return openFreezer(state, refresh);
    }
  });
  ui().append(top, dock);
}

/** A gentle pointer to what a new hunter should do next. */
function nextStep(state: GameState): string {
  if (!state.hunterEd) return 'Next: take the hunter education course.';
  if (!has(state, 'hunting-license')) return 'Next: buy a hunting license at the outfitter.';
  if (!state.equippedWeapon) return 'Next: buy a .22 rifle, ammo and a knife, then hunt squirrels and rabbits in the Oak Woodlot.';
  if (ammoCount(state, state.equippedWeapon) === 0) return `Next: buy ammo for your ${item(state.equippedWeapon).name}.`;
  if (state.harvests.length === 0) return 'Tip: walk slowly, keep the wind in your face, hunt at dawn or dusk.';
  return `Lessons learned: ${state.lessons.length}/${LESSONS.length}.`;
}

function modal(title: string, state: GameState, onClose: () => void): { root: HTMLElement; body: HTMLElement; setMoney(): void } {
  const back = el(`
    <div class="modal-back">
      <div class="modal pix">
        <header><h2>${title}</h2><span class="money"></span><button data-close>Close ✕</button></header>
        <div class="tabs"></div>
        <div class="body"></div>
      </div>
    </div>`);
  const setMoney = () => {
    back.querySelector('.money')!.textContent = `$${state.money}`;
  };
  setMoney();
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  back.querySelector('[data-close]')!.addEventListener('click', close);
  ui().append(back);
  return { root: back, body: back.querySelector('.body') as HTMLElement, setMoney };
}

function tabs(root: HTMLElement, names: [string, string][], current: string, pick: (id: string) => void): void {
  const bar = root.querySelector('.tabs') as HTMLElement;
  bar.innerHTML = names.map(([id, label]) => `<button data-tab="${id}" class="${id === current ? 'on' : ''}">${label}</button>`).join('');
  bar.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (t) pick(t.dataset.tab!);
  };
}

// ---------- Outfitter ----------

const SHOP_TABS: [ItemCategory | 'sell', string][] = [
  ['license', 'Licenses'],
  ['weapon', 'Guns & bows'],
  ['ammo', 'Ammo'],
  ['gear', 'Gear'],
  ['fishing', 'Fishing'],
  ['sell', 'Sell'],
];

const MAE_HELLO = '"Welcome in! Tap anything and I\'ll tell you what it\'s for. Knowing your gear is half of hunting."';

export function openShop(state: GameState, onClose: () => void, tab: string = 'license'): void {
  const { root, body, setMoney } = modal('Trailhead Outfitters', state, () => {
    window.clearInterval(blinker);
    onClose();
  });
  root.querySelector('.tabs')!.remove();
  let selected: string | null = null;
  let say = MAE_HELLO;

  body.classList.add('store');
  body.innerHTML = `
    <div class="store-scene">
      <canvas class="store-art" aria-label="Mae behind the counter at Trailhead Outfitters"></canvas>
      <div class="bubble" aria-live="polite"></div>
    </div>
    <div class="store-side">
      <div class="store-tabs"></div>
      <div class="grid"></div>
      <div class="detail"></div>
    </div>`;
  const art = body.querySelector('canvas') as HTMLCanvasElement;
  drawStore(art);
  // Mae blinks every few seconds.
  const blinker = window.setInterval(() => {
    drawStore(art, true);
    window.setTimeout(() => drawStore(art), 140);
  }, 3800);

  const items = () =>
    tab === 'sell'
      ? ITEMS.filter((i) => i.sellPrice !== undefined && count(state, i.id) > 0)
      : ITEMS.filter((i) => i.category === tab);

  const render = () => {
    setMoney();
    const off = discount(state);
    (body.querySelector('.bubble') as HTMLElement).innerHTML = `<b>Mae</b> ${say}${
      off > 0 ? `<div class="right">Community discount: ${Math.round(off * 100)}% off</div>` : ''
    }`;
    body.querySelector('.store-tabs')!.innerHTML = SHOP_TABS.map(
      ([id, label]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${label}</button>`,
    ).join('');

    const list = items();
    const grid = body.querySelector('.grid') as HTMLElement;
    if (tab === 'sell' && !list.length) {
      grid.innerHTML = '<p class="owned">Nothing to sell yet. Pelts, tails, feathers, hides and antlers from your hunts sell here. Bring a knife, or you only get the meat.</p>';
    } else {
      grid.innerHTML = list
        .map((i) => {
          const owned = count(state, i.id);
          const price = tab === 'sell' ? sellPrice(state, i.id) : buyPrice(state, i.id);
          const locked = tab !== 'sell' && !canBuy(state, i.id).ok;
          return `<button class="tile ${selected === i.id ? 'sel' : ''} ${locked ? 'locked' : ''}" data-item="${i.id}" title="${i.name}">
            ${iconImg(i.id)}
            <span class="tprice">$${price}</span>
            ${owned ? `<span class="badge">${tab === 'sell' || !i.unique ? owned : '✓'}</span>` : ''}
          </button>`;
        })
        .join('');
    }

    const detail = body.querySelector('.detail') as HTMLElement;
    if (tab === 'sell' && list.length) {
      const total = list.reduce((sum, i) => sum + sellPrice(state, i.id) * count(state, i.id), 0);
      const sel = selected && list.some((i) => i.id === selected) ? item(selected) : null;
      detail.innerHTML = `
        ${sel ? `<div class="drow">${iconImg(sel.id, 'icon big')}<div><div class="name">${sel.name} ×${count(state, sel.id)}</div>
          <div class="summary">$${sellPrice(state, sel.id)} each · Demand ${Math.round(demandOf(state, sel.id) * 100)}%${demandOf(state, sel.id) < 1 ? ', recovers daily' : ''}</div></div></div>
          <div class="dbtns"><button data-sell="${sel.id}">Sell 1</button><button data-sellall="${sel.id}">Sell all ${count(state, sel.id)}</button></div>` : ''}
        <button class="primary wide" data-sellhaul>Sell everything · about $${total}</button>`;
    } else if (selected && list.some((i) => i.id === selected)) {
      const i = item(selected);
      const check = canBuy(state, i.id);
      detail.innerHTML = `
        <div class="drow">${iconImg(i.id, 'icon big')}<div><div class="name">${i.name}${count(state, i.id) ? ` <span class="owned">(have ${count(state, i.id)})</span>` : ''}</div>
          <div class="summary">${i.summary}</div>
          ${check.ok ? '' : `<div class="reason">${check.reason}</div>`}</div></div>
        <div class="dbtns"><span class="price">$${buyPrice(state, i.id)}</span><button class="primary" data-buy="${i.id}" ${check.ok ? '' : 'disabled'}>Buy</button></div>`;
    } else {
      detail.innerHTML = `<p class="owned">${tab === 'sell' ? '' : 'Tap an item to see what it\'s for.'}</p>`;
    }
  };

  on(body, 'button', (t) => {
    const d = t.dataset;
    if (d.tab) {
      tab = d.tab;
      selected = null;
      say = tab === 'sell' ? '"Let\'s see what you brought me. Hides, pelts, tails and feathers. Meat stays with you, that\'s the law."' : MAE_HELLO;
    }
    if (d.item) {
      selected = d.item;
      const tip = item(d.item).tip;
      say = tip.startsWith('"') ? tip : `"${tip}"`;
    }
    if (d.buy) {
      buy(state, d.buy);
      say = '"Good choice. Take care of it and it\'ll take care of you."';
    }
    if (d.sell) sell(state, d.sell, 1);
    if (d.sellall) sell(state, d.sellall, count(state, d.sellall));
    if (t.hasAttribute('data-sellhaul')) {
      const earned = items().reduce((sum, i) => sum + sell(state, i.id, count(state, i.id)), 0);
      say = `"That comes to $${earned}. Pleasure doing business!"`;
      selected = null;
    }
    render();
  });
  render();
}

// ---------- Trader ----------

export function openTrader(state: GameState, onClose: () => void): void {
  const { root, body, setMoney } = modal(`${TRADER_NAME}'s Trading Post`, state, onClose);
  root.querySelector('.tabs')!.remove();
  let give: Basket = {};
  let take: Basket = {};
  let reply = `"I don't deal in cash. Bring me hides and tails and we'll talk."`;

  const add = (b: Basket, id: string, d: number) => {
    b[id] = (b[id] ?? 0) + d;
    if (b[id] <= 0) delete b[id];
  };

  const render = () => {
    setMoney();
    const v = evaluateTrade(state, give, take);
    const pct = v.needed ? Math.min(100, Math.round((v.give / v.needed) * 100)) : 0;
    const yours = Object.keys(state.inventory).filter((id) => TRADER_WANTS[id] && count(state, id) - (give[id] ?? 0) > 0);
    const his = Object.keys(state.traderStock).filter((id) => state.traderStock[id] - (take[id] ?? 0) > 0);
    const basket = (b: Basket, attr: string) =>
      Object.entries(b).map(([id, q]) => `<button class="chip" data-${attr}="${id}">${item(id).name} ×${q} ✕</button>`).join('') || '<span class="owned">Empty</span>';

    body.innerHTML = `
      <p class="say">${reply}</p>
      <div class="cols">
        <div>
          <h3>Your goods</h3>
          ${yours.map((id) => `<button class="chip" data-give="${id}">${item(id).name} ×${count(state, id) - (give[id] ?? 0)}</button>`).join('') || '<span class="owned">Nothing he wants. He likes hides, pelts, tails and antlers.</span>'}
          <h3 style="margin-top:12px">You offer (worth ${v.give} to him)</h3>
          <div class="offer">${basket(give, 'ungive')}</div>
        </div>
        <div>
          <h3>His used gear (rotates daily)</h3>
          ${his.map((id) => `<button class="chip" data-take="${id}">${item(id).name} · ${TRADER_GOODS[id]}</button>`).join('') || '<span class="owned">Sold out until tomorrow.</span>'}
          <h3 style="margin-top:12px">You ask for (he wants ${v.needed})</h3>
          <div class="offer">${basket(take, 'untake')}</div>
        </div>
      </div>
      <div class="meter"><div style="width:${pct}%"></div></div>
      <button class="primary" data-deal>Propose trade</button>
      <p class="owned">He values hides and pelts above shop prices, so trading can beat selling.
      He asks a ${Math.round((traderMargin(state) - 1) * 100)}% margin, which drops each time you trade.</p>
      <div class="row"><div><div class="name">🐕 Biscuit, his yellow Lab</div>
        <div class="summary">${
          state.hasDog
            ? 'Biscuit hunts with you now. She retrieves ducks from the water.'
            : canBorrowDog(state)
              ? '"You\'ve been square with me. Take Biscuit duck hunting, she\'s itching to go."'
              : `"She doesn\'t go out with strangers." Trade with Hollis ${DOG_TRUST - state.traderRep} more time(s).`
        }</div></div><div></div>
        <div>${canBorrowDog(state) ? '<button class="primary" data-dog>Take Biscuit along</button>' : ''}</div></div>`;
  };

  on(body, 'button', (t) => {
    const d = t.dataset;
    if (d.give) add(give, d.give, 1);
    if (d.ungive) add(give, d.ungive, -1);
    if (d.take) add(take, d.take, 1);
    if (d.untake) add(take, d.untake, -1);
    if (t.hasAttribute('data-dog')) {
      state.hasDog = true;
      reply = '"Bring her back with a full belly. She likes cold water."';
    }
    if (t.hasAttribute('data-deal')) {
      const v = executeTrade(state, give, take);
      reply = v.message;
      if (v.accept) {
        give = {};
        take = {};
      }
    }
    render();
  });
  render();
}

// ---------- Journal ----------

export function openJournal(state: GameState, onClose: () => void, tab = 'gear', onReset?: () => void): void {
  const { root, body } = modal('Journal', state, onClose);
  const render = () => {
    tabs(root, [['gear', 'Gear'], ['guide', 'Field guide'], ['fish', 'Fish log'], ['lessons', `Lessons ${state.lessons.length}/${LESSONS.length}`], ['log', 'Harvest log']], tab, (t) => {
      tab = t;
      render();
    });
    let html = '';
    if (tab === 'gear') {
      const weapons = ITEMS.filter((i) => i.weapon && has(state, i.id));
      html += '<h3>Carry which weapon?</h3>';
      if (!weapons.length) html += '<p class="owned">You don\'t own a weapon yet.</p>';
      for (const w of weapons) {
        const carried = state.equippedWeapon === w.id;
        html += `<div class="row"><div><div class="name">${w.name}</div>
          <div class="summary">Effective range ${w.weapon!.rangeYards} yd · Ammo: ${w.weapon!.ammo.map((a) => `${item(a).name.replace(/ \(.*\)/, '')} ${count(state, a)}`).join(', ')}</div></div>
          <div></div><div><button data-equip="${w.id}" ${carried ? 'disabled' : ''}>${carried ? 'Carrying' : 'Carry'}</button></div></div>`;
      }
      html += '<h3 style="margin-top:14px">Inventory</h3>';
      const inv = Object.entries(state.inventory);
      html += inv.length
        ? `<div class="inv">${inv.map(([id, q]) => `<span class="inv-item">${iconImg(id)}${item(id).name} ×${q}</span>`).join('')}</div>`
        : '<p class="owned">Empty.</p>';
      if (onReset) html += '<p><button class="link" data-reset>Start a new game</button></p>';
    } else if (tab === 'guide') {
      for (const a of ANIMALS) {
        const seen = state.seenAnimals.includes(a.id);
        html += seen
          ? `<h3>${a.name}</h3><ul class="facts">${a.fieldGuide.map((f) => `<li>${f}</li>`).join('')}
             <li>Legal with: ${a.legalAmmo.map((id) => item(id).name).join(', ')}${a.tag ? ` · Needs a ${item(a.tag).name}` : ''}</li></ul>`
          : `<h3 class="owned">??? (not seen yet)</h3>`;
      }
    } else if (tab === 'fish') {
      const log = state.fishLog ?? [];
      for (const f of FISH) {
        const mine = log.filter((c) => c.fish === f.id);
        const best = mine.reduce((m, c) => Math.max(m, c.lengthIn), 0);
        html += mine.length
          ? `<h3>${f.name} <span class="owned">· ${mine.length} caught · best ${best} in · ${mine.filter((c) => c.released).length} released</span></h3><ul class="facts">${f.fieldGuide.map((x) => `<li>${x}</li>`).join('')}<li>Keep only ${f.keepMinIn} in or longer.</li></ul>`
          : `<h3 class="owned">??? (not caught yet)</h3>`;
      }
    } else if (tab === 'lessons') {
      html += '<div class="lesson-grid">';
      for (const l of LESSONS) {
        html += state.lessons.includes(l.id)
          ? `<div class="lesson"><b>${l.title}</b><br>${l.text}</div>`
          : `<div class="lesson locked"><b>???</b><br>Not learned yet.</div>`;
      }
      html += '</div>';
    } else {
      html += state.harvests.length
        ? state.harvests.map((h) => `<div class="row"><div>Day ${h.day}: ${ANIMALS.find((a) => a.id === h.animal)!.name} · ${h.quality} · ${item(h.weapon).name}</div></div>`).join('')
        : '<p class="owned">No harvests yet.</p>';
    }
    body.innerHTML = html;
  };
  on(body, '[data-equip]', (t) => {
    state.equippedWeapon = t.dataset.equip!;
    render();
  });
  on(body, '[data-reset]', (t) => {
    // Browser confirm dialogs are blocked in embedded pages, so confirm in place.
    if (t.dataset.armed) return onReset?.();
    t.dataset.armed = '1';
    t.textContent = 'Tap again to delete your progress';
    t.classList.add('danger');
  });
  render();
}

// ---------- Hunter education ----------

export function openHunterEd(state: GameState, onClose: () => void): void {
  const { root, body } = modal('Hunter Education Course', state, onClose);
  root.querySelector('.tabs')!.remove();
  let i = 0;
  let score = 0;
  let answered: number | null = null;

  const render = () => {
    if (i >= QUIZ.length) {
      const passed = score >= PASS_SCORE;
      if (passed && !state.hunterEd) state.hunterEd = true;
      body.innerHTML = `<h3>${passed ? '🎓 Passed!' : 'Not quite.'} ${score}/${QUIZ.length}</h3>
        <p>${passed ? 'You earned your hunter education certificate. Now buy a hunting license at the outfitter.' : `You need ${PASS_SCORE} correct. Read the explanations and try again.`}</p>
        <button data-retry>${passed ? 'Take it again' : 'Try again'}</button>`;
      return;
    }
    const q = QUIZ[i];
    body.innerHTML = `<p class="owned">Question ${i + 1} of ${QUIZ.length} · Score ${score}</p><h3>${q.q}</h3>
      ${q.options.map((o, n) => {
        const cls = answered === null ? '' : n === q.answer ? 'right' : n === answered ? 'wrong' : '';
        return `<button class="quiz-opt ${cls}" data-opt="${n}" ${answered !== null ? 'disabled' : ''}>${o}</button>`;
      }).join('')}
      ${answered !== null ? `<p class="${answered === q.answer ? 'right' : 'wrong'}">${answered === q.answer ? 'Correct.' : 'Not quite.'} ${q.why}</p><button class="primary" data-next>Next</button>` : ''}`;
  };

  on(body, 'button', (t) => {
    if (t.dataset.opt !== undefined) {
      answered = Number(t.dataset.opt);
      if (answered === QUIZ[i].answer) score++;
    } else if (t.hasAttribute('data-next')) {
      i++;
      answered = null;
    } else if (t.hasAttribute('data-retry')) {
      i = 0;
      score = 0;
      answered = null;
    }
    render();
  });
  render();
}

// ---------- Freezer ----------

export function openFreezer(state: GameState, onClose: () => void): void {
  const { root, body } = modal('Freezer & Donations', state, onClose);
  root.querySelector('.tabs')!.remove();
  const render = (msg = '') => {
    const meats = Object.entries(state.freezer);
    body.innerHTML = `<p class="say">Wild game meat can't be sold in most of the US. You can eat it, or donate it to feed families.
      Donating raises your community reputation, and Mae gives regulars a discount (up to 15%).</p>
      ${meats.length ? meats.map(([m, lbs]) => `<div class="row"><div class="name">${m}</div><div>${lbs} lbs</div><div></div></div>`).join('') : '<p class="owned">The freezer is empty.</p>'}
      <p>Community reputation: <b>${state.reputation}</b></p>
      <button class="primary" data-donate ${meats.length ? '' : 'disabled'}>Donate all meat</button>
      <p class="right">${msg}</p>`;
  };
  on(body, '[data-donate]', () => {
    const r = donateMeat(state);
    teach(state, 'donate');
    render(`You donated ${r.lbs} lbs. Reputation +${r.rep}.`);
  });
  render();
}

// ---------- Area select ----------

function openAreaSelect(state: GameState, actions: CampActions): void {
  const { root, body } = modal('Where will you hunt today?', state, () => {});
  root.querySelector('.tabs')!.remove();
  const weapon = state.equippedWeapon ? item(state.equippedWeapon) : null;
  body.innerHTML = `
    <p class="say">Carrying: ${weapon ? `${weapon.name} (${ammoCount(state, weapon.id)} rounds)` : 'no weapon. You can still scout.'}${state.hasDog ? ' · 🐕 Biscuit comes along' : ''}
     · Gear: ${['knife', 'orange-vest', 'binoculars', 'scent-spray', 'grunt-call', 'box-call', 'tree-stand', 'duck-stamp', 'waders', 'decoys', 'duck-call'].filter((g) => has(state, g)).map((g) => item(g).name).join(', ') || 'none'}</p>
    ${AREAS.map((a) => `<div class="row"><div><div class="name">${a.name}</div><div class="summary">${a.description}</div>
      ${a.orangeRequired ? '<div class="reason">Firearm deer season: blaze orange required with a firearm.</div>' : ''}</div>
      <div></div><div><button data-area="${a.id}">Hunt here</button></div></div>`).join('')}
    <h3 style="margin-top:14px">Controls</h3>
    ${isTouch() ? `<ul class="facts">
      <li><b>◀ ▶</b> walk · <b>Run</b> and <b>Crouch</b> switch on and off</li>
      <li><b>Touch and hold</b> the scene to aim, slide onto the animal, <b>let go</b> to shoot</li>
      <li><b>✋</b> appears when there's something to tag or pick up · <b>⛺</b> heads back to camp</li>
    </ul>` : `<ul class="facts">
      <li><b>A / D</b> or arrows: walk · <b>hold Shift</b>: run (loud) · <b>S</b>: crouch and sneak</li>
      <li><b>Right-click</b> or <b>F</b>: raise your weapon · <b>hold Space</b>: hold your breath to steady · <b>Left-click</b>: shoot</li>
      <li><b>E</b>: tag and field dress / pick up · <b>B</b>: binoculars · <b>C</b>: use a call · <b>T</b>: tree stand · <b>Q</b>: switch weapon</li>
      <li><b>Esc</b>: head back to camp (ends the day)</li>
    </ul>`}`;
  on(body, '[data-area]', (t) => {
    root.remove();
    actions.hunt(t.dataset.area!);
  });
}

/** After a hunt: what you brought back, with one tap to sell it all to Mae. */
export function showHaul(state: GameState, s: HuntSummary, onDone: () => void): void {
  const haul = Object.entries(s.items).filter(([id]) => item(id).sellPrice !== undefined);
  const value = haul.reduce((sum, [id, q]) => sum + sellPrice(state, id) * Math.min(q, count(state, id)), 0);
  const notes = [
    s.harvested.length ? `Harvested: ${s.harvested.join(', ')}` : 'No harvest today. Every hunt teaches something.',
    s.meatLbs ? `+${s.meatLbs} lbs of meat in the freezer` : '',
    s.fines ? `<span class="wrong">Fines paid: $${s.fines}</span>` : '',
    s.newLessons ? `${s.newLessons} new lesson${s.newLessons > 1 ? 's' : ''} in your journal` : '',
  ].filter(Boolean);

  const box = el(`
    <div class="summary-box pix haul">
      <h2>Back at camp</h2>
      <div class="sub">${s.areaName} · now day ${state.day}</div>
      ${haul.length ? `<div class="haul-grid">${haul.map(([id, q]) => `
        <div class="haul-item">${iconImg(id, 'icon big')}<div><b>${item(id).name}</b> ×${q}<br><span class="price">$${sellPrice(state, id)} each</span></div></div>`).join('')}</div>` : ''}
      <ul class="facts">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>
      <div class="haul-total">Your money: <span class="money">$${state.money}</span></div>
      <div class="dbtns">
        ${haul.length ? `<button class="primary" data-sell>Sell haul to Mae · $${value}</button><button data-keep>Keep it</button>` : '<button class="primary" data-keep>Continue</button>'}
      </div>
      ${haul.length ? '<p class="owned">Keep pelts and hides to trade with Old Hollis. He pays more for them in gear.</p>' : ''}
    </div>`);
  const close = () => {
    box.remove();
    onDone();
  };
  box.querySelector('[data-keep]')!.addEventListener('click', close);
  box.querySelector('[data-sell]')?.addEventListener('click', (e) => {
    const start = state.money;
    for (const [id, q] of haul) sell(state, id, Math.min(q, count(state, id)));
    const earned = state.money - start;
    // Count the money up, like a register.
    const money = box.querySelector('.haul-total .money') as HTMLElement;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / 700);
      money.textContent = `$${Math.round(start + earned * f)}`;
      if (f < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    (e.currentTarget as HTMLElement).replaceWith(el(`<span class="right">Sold for $${earned}!</span>`));
    const keep = box.querySelector('[data-keep]') as HTMLElement;
    keep.textContent = 'Continue';
    keep.classList.add('primary');
    box.querySelectorAll('.haul-item').forEach((n) => n.classList.add('sold'));
  });
  ui().append(box);
}

// ---------- Fly fishing ----------

/** Gear check before heading to the creek. */
function openRiver(state: GameState, actions: CampActions): void {
  const { root, body } = modal('Aspen Creek', state, () => {});
  root.querySelector('.tabs')!.remove();
  const need: [string, boolean][] = [
    ['fishing-license', true],
    ['trout-stamp', true],
    ['fly-rod', true],
    ['landing-net', false],
    ['waders', false],
  ];
  const flies = Object.keys(FLIES).filter((f) => has(state, f));
  body.innerHTML = `
    <p class="say">A cold, clear trout stream through the golden aspens. Mayflies hatch late morning, caddis in the evening.</p>
    <div class="inv">${need.map(([id, req]) => `<span class="inv-item ${has(state, id) ? '' : 'missing'}">${iconImg(id)}${item(id).name} ${has(state, id) ? '✓' : req ? '<span class="wrong">needed</span>' : '<span class="owned">optional</span>'}</span>`).join('')}</div>
    <p>${flies.length ? `Fly box: ${flies.map((f) => `${iconImg(f)} ${item(f).name.replace(/ \(.*\)/, '')} ×${count(state, f)}`).join(' · ')}` : '<span class="wrong">No flies yet.</span> Mae sells them in the Fishing tab.'}</p>
    <div class="dbtns"><button class="primary" data-go>Start fishing</button></div>
    <h3>How to fish</h3>
    <ul class="facts">
      <li><b>${isTouch() ? 'Touch and hold' : 'Hold the mouse'}</b> on the water where you want your fly. <b>Let go</b> when the ring closes on the target for a soft cast.</li>
      <li>When a trout takes your fly, <b>${isTouch() ? 'tap' : 'click or press Space'}</b> right away to set the hook.</li>
      <li>Fighting a fish: <b>hold to reel</b>, let go when it runs. Keep the needle in the green.</li>
      <li>${isTouch() ? '🪰 changes your fly' : 'Q changes your fly'} · walk the bank to find rising trout · crouch so they don't see you.</li>
    </ul>`;
  on(body, '[data-go]', () => {
    root.remove();
    actions.fish();
  });
}

export function showFishSummary(state: GameState, s: FishSummary, onDone: () => void): void {
  const kept = s.catches.filter((c) => !c.released);
  const box = el(`
    <div class="summary-box pix haul">
      <h2>Back from the creek</h2>
      <div class="sub">Aspen Creek · now day ${state.day}</div>
      ${s.catches.length ? `<ul class="facts">${s.catches.map((c) => `<li>${FISH.find((f) => f.id === c.fish)!.name}, ${c.lengthIn} in, on a ${item(c.fly).name.replace(/ \(.*\)/, '')} · ${c.released ? 'released' : 'kept'}</li>`).join('')}</ul>` : '<p>No fish today. Try matching the hatch, or a nymph when nothing is rising.</p>'}
      <ul class="facts">
        ${s.repGained ? `<li class="right">Community reputation +${s.repGained} for releasing fish</li>` : ''}
        ${kept.length ? `<li>+${s.meatLbs} lbs of trout in the freezer</li>` : ''}
        ${s.newLessons ? `<li>${s.newLessons} new lesson${s.newLessons > 1 ? 's' : ''} in your journal</li>` : ''}
      </ul>
      <div class="dbtns"><button class="primary" data-done>Continue</button></div>
    </div>`);
  box.querySelector('[data-done]')!.addEventListener('click', () => {
    box.remove();
    onDone();
  });
  ui().append(box);
}
