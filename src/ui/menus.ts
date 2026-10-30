import { buy, buyPrice, canBuy, demandOf, discount, donateMeat, sell, sellPrice } from '../core/economy';
import { count, has } from '../core/state';
import {
  evaluateTrade,
  executeTrade,
  TRADER_GOODS,
  TRADER_NAME,
  TRADER_WANTS,
  traderMargin,
  type Basket,
} from '../core/trade';
import type { GameState, ItemCategory } from '../core/types';
import { ANIMALS, AREAS } from '../data/animals';
import { ITEMS, item } from '../data/items';
import { LESSONS, PASS_SCORE, QUIZ } from '../data/lessons';
import { teach } from './cards';

const ui = () => document.getElementById('ui')!;

export interface CampActions {
  hunt(areaId: string): void;
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
  const weapon = state.equippedWeapon ? item(state.equippedWeapon).name : 'none';
  const menu = el(`
    <div class="camp-menu">
      <h1>Base Camp</h1>
      <div class="sub">Day ${state.day} · <span class="money">$${state.money}</span> · Carrying: ${weapon}</div>
      <button class="primary" data-a="hunt">🌲 Go hunting</button>
      <button data-a="shop">🏪 Trailhead Outfitters</button>
      <button data-a="trader">🧺 ${TRADER_NAME}'s trading post</button>
      <button data-a="journal">📓 Journal &amp; gear</button>
      <button data-a="ed">🎓 Hunter education ${state.hunterEd ? '✓' : ''}</button>
      <button data-a="freezer">❄️ Freezer &amp; donations</button>
      <div class="hint">${nextStep(state)}</div>
      <div class="hint"><a href="#" data-a="reset" style="color:var(--muted)">Start over</a></div>
    </div>`);
  const refresh = () => {
    actions.save();
    showCamp(state, actions);
  };
  on(menu, '[data-a]', (t) => {
    switch (t.dataset.a) {
      case 'hunt': return openAreaSelect(state, actions);
      case 'shop': return openShop(state, refresh);
      case 'trader': return openTrader(state, refresh);
      case 'journal': return openJournal(state, refresh);
      case 'ed': return openHunterEd(state, refresh);
      case 'freezer': return openFreezer(state, refresh);
      case 'reset':
        if (confirm('Delete your save and start over?')) actions.reset();
    }
  });
  ui().append(menu);
}

/** A gentle pointer to what a new hunter should do next. */
function nextStep(state: GameState): string {
  if (!state.hunterEd) return 'Next: take the hunter education course.';
  if (!has(state, 'hunting-license')) return 'Next: buy a hunting license at the outfitter.';
  if (!state.equippedWeapon) return 'Next: buy a .22 rifle, ammo and a knife, then hunt squirrels and rabbits in the Oak Woodlot.';
  const w = item(state.equippedWeapon).weapon!;
  if (count(state, w.ammo) === 0) return `Next: buy ammo for your ${item(state.equippedWeapon).name}.`;
  if (state.harvests.length === 0) return 'Tip: walk slowly, keep the wind in your face, hunt at dawn or dusk.';
  return `Lessons learned: ${state.lessons.length}/${LESSONS.length}.`;
}

function modal(title: string, state: GameState, onClose: () => void): { root: HTMLElement; body: HTMLElement; setMoney(): void } {
  const back = el(`
    <div class="modal-back">
      <div class="modal">
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
  ['license', 'Licenses & tags'],
  ['weapon', 'Firearms & bows'],
  ['ammo', 'Ammo'],
  ['gear', 'Gear'],
  ['sell', 'Sell'],
];

export function openShop(state: GameState, onClose: () => void, tab: string = 'license'): void {
  const { root, body, setMoney } = modal('Trailhead Outfitters', state, onClose);
  const openTips = new Set<string>();

  const render = () => {
    setMoney();
    tabs(root, SHOP_TABS, tab, (t) => {
      tab = t;
      render();
    });
    const off = discount(state);
    let html = `<p class="say">Mae, the clerk: "Ask me about anything. Knowing your gear is half of hunting."${
      off > 0 ? ` <b class="right">Community discount: ${Math.round(off * 100)}%</b>` : ''
    }</p>`;
    if (tab === 'sell') {
      const loot = ITEMS.filter((i) => i.sellPrice !== undefined && count(state, i.id) > 0);
      if (!loot.length) html += '<p>You have nothing to sell yet. Hides, tails, feathers and antlers from your hunts sell here. Meat cannot be sold.</p>';
      for (const i of loot) {
        const d = demandOf(state, i.id);
        html += `<div class="row">
          <div><div class="name">${i.name} <span class="owned">×${count(state, i.id)}</span></div>
          <div class="summary">${i.summary} · Demand ${Math.round(d * 100)}%${d < 1 ? ' (recovers daily)' : ''}</div></div>
          <div class="price">$${sellPrice(state, i.id)}</div>
          <div><button data-sell="${i.id}">Sell 1</button> <button data-sellall="${i.id}">Sell all</button></div>
          ${openTips.has(i.id) ? `<div class="tip">${i.tip}</div>` : ''}
        </div>`;
      }
    } else {
      for (const i of ITEMS.filter((x) => x.category === tab)) {
        const check = canBuy(state, i.id);
        const owned = count(state, i.id);
        html += `<div class="row">
          <div><div class="name">${i.name} ${owned ? `<span class="owned">(have ${owned})</span>` : ''}</div>
          <div class="summary">${i.summary}</div>
          ${check.ok ? '' : `<div class="reason">${check.reason}</div>`}</div>
          <div class="price">$${buyPrice(state, i.id)}</div>
          <div><button data-tip="${i.id}">Ask Mae</button> <button class="primary" data-buy="${i.id}" ${check.ok ? '' : 'disabled'}>Buy</button></div>
          ${openTips.has(i.id) ? `<div class="tip">${i.tip}</div>` : ''}
        </div>`;
      }
    }
    body.innerHTML = html;
  };

  on(body, 'button', (t) => {
    const d = t.dataset;
    if (d.tip) openTips.has(d.tip) ? openTips.delete(d.tip) : openTips.add(d.tip);
    if (d.buy) {
      buy(state, d.buy);
      openTips.add(d.buy);
    }
    if (d.sell) sell(state, d.sell, 1);
    if (d.sellall) sell(state, d.sellall, count(state, d.sellall));
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
      He asks a ${Math.round((traderMargin(state) - 1) * 100)}% margin, which drops each time you trade.</p>`;
  };

  on(body, 'button', (t) => {
    const d = t.dataset;
    if (d.give) add(give, d.give, 1);
    if (d.ungive) add(give, d.ungive, -1);
    if (d.take) add(take, d.take, 1);
    if (d.untake) add(take, d.untake, -1);
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

export function openJournal(state: GameState, onClose: () => void, tab = 'gear'): void {
  const { root, body } = modal('Journal', state, onClose);
  const render = () => {
    tabs(root, [['gear', 'Gear'], ['guide', 'Field guide'], ['lessons', `Lessons ${state.lessons.length}/${LESSONS.length}`], ['log', 'Harvest log']], tab, (t) => {
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
          <div class="summary">Effective range ${w.weapon!.rangeYards} yd · Ammo: ${count(state, w.weapon!.ammo)}</div></div>
          <div></div><div><button data-equip="${w.id}" ${carried ? 'disabled' : ''}>${carried ? 'Carrying' : 'Carry'}</button></div></div>`;
      }
      html += '<h3 style="margin-top:14px">Inventory</h3>';
      const inv = Object.entries(state.inventory);
      html += inv.length ? inv.map(([id, q]) => `<span class="chip lesson">${item(id).name} ×${q}</span>`).join('') : '<p class="owned">Empty.</p>';
    } else if (tab === 'guide') {
      for (const a of ANIMALS) {
        const seen = state.seenAnimals.includes(a.id);
        html += seen
          ? `<h3>${a.name}</h3><ul class="facts">${a.fieldGuide.map((f) => `<li>${f}</li>`).join('')}
             <li>Legal with: ${a.legalAmmo.map((id) => item(id).name).join(', ')}${a.tag ? ` · Needs a ${item(a.tag).name}` : ''}</li></ul>`
          : `<h3 class="owned">??? (not seen yet)</h3>`;
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
    <p class="say">Carrying: ${weapon ? `${weapon.name} (${count(state, weapon.weapon!.ammo)} rounds)` : 'no weapon. You can still scout.'}
     · Gear: ${['knife', 'orange-vest', 'binoculars', 'scent-spray', 'grunt-call', 'box-call', 'tree-stand'].filter((g) => has(state, g)).map((g) => item(g).name).join(', ') || 'none'}</p>
    ${AREAS.map((a) => `<div class="row"><div><div class="name">${a.name}</div><div class="summary">${a.description}</div>
      ${a.orangeRequired ? '<div class="reason">Firearm deer season: blaze orange required with a firearm.</div>' : ''}</div>
      <div></div><div><button class="primary" data-area="${a.id}">Hunt here</button></div></div>`).join('')}
    <h3 style="margin-top:14px">Controls</h3>
    <ul class="facts">
      <li><b>A / D</b> or arrows: walk · <b>hold Shift</b>: run (loud) · <b>S</b>: crouch and sneak</li>
      <li><b>Right-click</b> or <b>F</b>: raise your weapon · <b>hold Space</b>: hold your breath to steady · <b>Left-click</b>: shoot</li>
      <li><b>E</b>: tag and field dress / pick up · <b>B</b>: binoculars · <b>C</b>: use a call · <b>T</b>: tree stand · <b>Q</b>: switch weapon</li>
      <li><b>Esc</b>: head back to camp (ends the day)</li>
    </ul>`;
  on(body, '[data-area]', (t) => {
    root.remove();
    actions.hunt(t.dataset.area!);
  });
}

export function showSummary(lines: string[], onDone: () => void): void {
  const box = el(`<div class="summary-box"><h2>Back at camp</h2>${lines.map((l) => `<p>${l}</p>`).join('')}<button class="primary">Continue</button></div>`);
  box.querySelector('button')!.addEventListener('click', () => {
    box.remove();
    onDone();
  });
  ui().append(box);
}
