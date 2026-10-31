import { describe, expect, it } from 'vitest';
import { animal } from '../src/data/animals';
import { ITEMS } from '../src/data/items';
import { LESSONS } from '../src/data/lessons';
import { fish } from '../src/data/fish';
import { cannotFish, cannotKeep, castQuality, hatchAt, newFight, running, stepFight, strikeRate } from '../src/core/fishing';
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
    expect(checkShot(s, deer, 'rifle-308', 100, 8)).toEqual({ ok: true, ammo: 'ammo-308' });
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

describe('waterfowl rules', () => {
  const duck = animal('mallard');
  const ready = () => {
    const s = hunterWith('hunting-license', 'shotgun-20', 'duck-stamp');
    addItem(s, 'ammo-steel', 25);
    return s;
  };

  it('needs a duck stamp', () => {
    const s = hunterWith('hunting-license', 'shotgun-20');
    addItem(s, 'ammo-steel', 25);
    expect(checkShot(s, duck, 'shotgun-20', 30, 8).lesson).toBe('duck-stamp');
  });

  it('refuses lead shot, even when carrying it', () => {
    const s = hunterWith('hunting-license', 'shotgun-20', 'duck-stamp');
    addItem(s, 'ammo-turkey', 10);
    expect(checkShot(s, duck, 'shotgun-20', 30, 8).lesson).toBe('steel-shot');
  });

  it('picks steel for ducks and turkey loads for turkeys from the same gun', () => {
    const s = ready();
    addItem(s, 'ammo-turkey', 10);
    addItem(s, 'turkey-tag', 1);
    expect(checkShot(s, duck, 'shotgun-20', 30, 8).ammo).toBe('ammo-steel');
    expect(checkShot(s, animal('turkey'), 'shotgun-20', 30, 8).ammo).toBe('ammo-turkey');
  });

  it('ends shooting at sunset and enforces the bag limit', () => {
    const s = ready();
    expect(checkShot(s, duck, 'shotgun-20', 30, 18.7).lesson).toBe('waterfowl-hours');
    expect(checkShot(s, duck, 'shotgun-20', 30, 8, 3).ok).toBe(true);
    expect(checkShot(s, duck, 'shotgun-20', 30, 8, 4).lesson).toBe('bag-limit');
  });

  it('every lesson a shot check can return exists', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    for (const l of ['duck-stamp', 'steel-shot', 'waterfowl-hours', 'bag-limit', 'retrieve', 'lost-bird', 'lead-bird', 'dog', 'decoys', 'duck-down']) {
      expect(ids.has(l)).toBe(true);
    }
  });
});

describe('fly fishing', () => {
  const rainbow = fish('rainbow');

  it('needs a license, a trout stamp, a rod and a fly', () => {
    const s = newGame();
    expect(cannotFish(s, 'fly-adams')).toBe('fishing-license');
    addItem(s, 'fishing-license', 1);
    expect(cannotFish(s, 'fly-adams')).toBe('trout-stamp');
    addItem(s, 'trout-stamp', 1);
    expect(cannotFish(s, 'fly-adams')).toBe('no-rod');
    addItem(s, 'fly-rod', 1);
    expect(cannotFish(s, 'fly-adams')).toBe('no-flies');
    addItem(s, 'fly-adams', 6);
    expect(cannotFish(s, 'fly-adams')).toBe(null);
  });

  it('rewards matching the hatch', () => {
    expect(hatchAt(10)).toBe('mayfly');
    expect(hatchAt(18)).toBe('caddis');
    expect(hatchAt(14)).toBe(null);
    expect(strikeRate(rainbow, 'mayfly', 10, 1)).toBeGreaterThan(strikeRate(rainbow, 'caddis', 10, 1) * 5);
    // Nymphs work when nothing is hatching; dry flies barely do.
    expect(strikeRate(rainbow, 'nymph', 14, 1)).toBeGreaterThan(strikeRate(rainbow, 'mayfly', 14, 1) * 3);
    // Streamers want low light.
    expect(strikeRate(fish('brown'), 'streamer', 7, 1)).toBeGreaterThan(strikeRate(fish('brown'), 'streamer', 12, 1));
  });

  it('a sloppy cast catches less', () => {
    expect(castQuality(0)).toBe(1);
    expect(castQuality(0.05)).toBe(1);
    expect(castQuality(0.5)).toBe(0);
    expect(strikeRate(rainbow, 'nymph', 12, 1)).toBeGreaterThan(strikeRate(rainbow, 'nymph', 12, 0));
  });

  it('enforces size and daily limits', () => {
    expect(cannotKeep(rainbow, 10, 0)).toBe('keep-size');
    expect(cannotKeep(rainbow, 14, 2)).toBe('fish-limit');
    expect(cannotKeep(rainbow, 14, 1)).toBe(null);
  });

  it('just holding to reel lands a fish that is not running', () => {
    const f = newFight();
    let r = 'on';
    for (let i = 0; i < 2000 && r === 'on'; i++) r = stepFight(f, true, 1, 0.05, () => 0.99);
    expect(r).toBe('landed');
  });

  it('snaps only when you keep cranking through hard runs, throws the hook on slack', () => {
    const f = newFight();
    let r = 'on';
    for (let i = 0; i < 400 && r === 'on'; i++) r = stepFight(f, true, 2, 0.05, () => 0);
    expect(r).toBe('snapped');
    const g = newFight();
    r = 'on';
    for (let i = 0; i < 400 && r === 'on'; i++) r = stepFight(g, false, 1, 0.05, () => 0.99);
    expect(r).toBe('thrown');
  });

  it('lands a fish when you keep tension in the zone', () => {
    const f = newFight();
    let r = 'on';
    for (let i = 0; i < 2000 && r === 'on'; i++) r = stepFight(f, !running(f, 1.5), 1.5, 0.05);
    expect(r).toBe('landed');
  });
});
