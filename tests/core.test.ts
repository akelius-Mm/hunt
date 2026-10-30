import { describe, expect, it } from 'vitest';
import { animal } from '../src/data/animals';
import { ITEMS } from '../src/data/items';
import { buy, canBuy, donateMeat, nextDay, sell, sellPrice } from '../src/core/economy';
import { checkShot, harvest, resolveShot, senses, zoneAt, type SenseContext } from '../src/core/hunting';
import { addItem, newGame } from '../src/core/state';
import { evaluateTrade, executeTrade, rollTraderStock } from '../src/core/trade';

function hunterWith(...items: string[]) {
  const s = newGame();
  s.hunterEd = true;
  for (const id of items) addItem(s, id, 1);
  return s;
}

describe('outfitter', () => {
  it('requires hunter education before a license', () => {
    const s = newGame();
    expect(canBuy(s, 'hunting-license').ok).toBe(false);
    s.hunterEd = true;
    expect(buy(s, 'hunting-license').ok).toBe(true);
    expect(s.money).toBe(220);
    expect(canBuy(s, 'hunting-license').reason).toMatch(/already/);
  });

  it('gives a full pack of ammo and equips the first weapon', () => {
    const s = hunterWith('hunting-license');
    buy(s, 'rifle-22');
    buy(s, 'ammo-22');
    expect(s.inventory['ammo-22']).toBe(50);
    expect(s.equippedWeapon).toBe('rifle-22');
  });

  it('lowers prices as you sell and recovers them overnight', () => {
    const s = newGame();
    addItem(s, 'rabbit-pelt', 3);
    expect(sellPrice(s, 'rabbit-pelt')).toBe(12);
    const earned = sell(s, 'rabbit-pelt', 3);
    expect(earned).toBe(12 + 11 + 10);
    const low = sellPrice(s, 'rabbit-pelt');
    nextDay(s);
    expect(sellPrice(s, 'rabbit-pelt')).toBeGreaterThan(low);
  });

  it('turns donated meat into reputation', () => {
    const s = newGame();
    s.freezer = { Venison: 50, Rabbit: 2 };
    expect(donateMeat(s)).toEqual({ lbs: 52, rep: 11 });
    expect(s.freezer).toEqual({});
  });

  it('has a tip for every item', () => {
    for (const i of ITEMS) expect(i.tip.length).toBeGreaterThan(20);
  });
});

describe('shot rules', () => {
  const deer = animal('doe');

  it('checks license, hours, weapon, tag, ammo and range in order', () => {
    const s = newGame();
    expect(checkShot(s, deer, 'rifle-308', 50, 8).lesson).toBe('no-license');
    addItem(s, 'hunting-license', 1);
    expect(checkShot(s, deer, 'rifle-308', 50, 5).lesson).toBe('shooting-hours');
    expect(checkShot(s, deer, 'rifle-22', 50, 8).lesson).toBe('wrong-weapon');
    expect(checkShot(s, deer, 'rifle-308', 50, 8).lesson).toBe('no-tag');
    addItem(s, 'deer-tag', 1);
    expect(checkShot(s, deer, 'rifle-308', 50, 8).lesson).toBe('no-ammo');
    addItem(s, 'ammo-308', 20);
    expect(checkShot(s, deer, 'rifle-308', 400, 8).lesson).toBe('out-of-range');
    expect(checkShot(s, deer, 'rifle-308', 100, 8).ok).toBe(true);
  });

  it('rewards the vitals and punishes risky shots', () => {
    expect(zoneAt(deer, 18, 15)).toBe('vitals');
    expect(zoneAt(deer, 26, 6)).toBe('head');
    expect(zoneAt(deer, 8, 15)).toBe('body');
    expect(resolveShot(deer, 'centerfire', 'vitals')).toMatchObject({ result: 'clean', quality: 'Prime' });
    expect(resolveShot(deer, 'centerfire', 'head').lesson).toBe('head-risk');
    expect(resolveShot(deer, 'centerfire', 'body').result).toBe('wounded');
    expect(resolveShot(deer, 'centerfire', null).result).toBe('miss');
    expect(resolveShot(animal('turkey'), 'shotgun', 'body').lesson).toBe('turkey-head');
    expect(resolveShot(animal('turkey'), 'shotgun', 'head').result).toBe('clean');
  });
});

describe('senses', () => {
  const deer = animal('buck');
  const base: SenseContext = { distanceYards: 120, movement: 'still', inStand: false, windDir: 1, animalSide: -1, scentSpray: false };

  it('smells you only when downwind', () => {
    expect(senses(deer, base).cause).toBe(null);
    expect(senses(deer, { ...base, animalSide: 1 }).cause).toBe('scent');
  });

  it('hears running but not sneaking', () => {
    const near = { ...base, distanceYards: 50 };
    expect(senses(deer, { ...near, movement: 'run' }).cause).toBe('sound');
    expect(senses(deer, { ...near, movement: 'sneak' }).cause).not.toBe('sound');
  });

  it('a tree stand hides you', () => {
    const near = { ...base, distanceYards: 40, movement: 'sneak' as const };
    expect(senses(deer, near).perSecond).toBeGreaterThan(senses(deer, { ...near, inStand: true }).perSecond);
  });
});

describe('harvest', () => {
  it('uses the tag and gives loot and meat', () => {
    const s = hunterWith('hunting-license', 'deer-tag', 'knife');
    const r = harvest(s, animal('buck'), 'Prime', 'rifle-308', () => 0);
    expect(s.inventory['deer-tag']).toBeUndefined();
    expect(r.items).toEqual({ 'deer-hide': 1, antlers: 1 });
    expect(s.freezer.Venison).toBe(50);
  });

  it('loses the parts without a knife', () => {
    const s = hunterWith('hunting-license');
    const r = harvest(s, animal('rabbit'), 'Prime', 'rifle-22');
    expect(r.items).toEqual({});
    expect(r.lessons).toContain('no-knife');
  });
});

describe('trader', () => {
  it('wants a margin and gets friendlier', () => {
    const s = newGame();
    s.traderStock = { 'ammo-308': 1 };
    addItem(s, 'rabbit-pelt', 2);
    expect(evaluateTrade(s, { 'rabbit-pelt': 2 }, { 'ammo-308': 1 }).accept).toBe(false);
    addItem(s, 'deer-hide', 1);
    const v = executeTrade(s, { 'deer-hide': 1 }, { 'ammo-308': 1 });
    expect(v.accept).toBe(true);
    expect(s.inventory['ammo-308']).toBe(20);
    expect(s.traderRep).toBe(1);
  });

  it('refuses things he does not want', () => {
    const s = newGame();
    s.traderStock = { knife: 1 };
    addItem(s, 'ammo-22', 50);
    expect(evaluateTrade(s, { 'ammo-22': 50 }, { knife: 1 }).message).toMatch(/no use/);
  });

  it('has the same stock for the same day', () => {
    expect(rollTraderStock(4)).toEqual(rollTraderStock(4));
  });
});
