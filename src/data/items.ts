import type { ItemDef } from '../core/types';

/** Requirement token meaning "passed the hunter education quiz". */
export const HUNTER_ED = 'hunter-ed';

export const ITEMS: ItemDef[] = [
  // Licenses and tags
  {
    id: 'hunting-license',
    name: 'Hunting License',
    category: 'license',
    price: 30,
    unique: true,
    requires: [HUNTER_ED],
    summary: 'Required to hunt anything.',
    tip: 'Every state requires a hunting license. New hunters usually need a hunter education certificate first. Carry your license with you whenever you hunt.',
  },
  {
    id: 'turkey-tag',
    name: 'Turkey Tag',
    category: 'license',
    price: 20,
    requires: ['hunting-license'],
    summary: 'One tag = one turkey.',
    tip: 'Big game and turkeys need a tag on top of your license. Each tag is good for one animal. You attach it right after the harvest, before you move the animal.',
  },
  {
    id: 'deer-tag',
    name: 'Deer Tag',
    category: 'license',
    price: 30,
    requires: ['hunting-license'],
    summary: 'One tag = one deer.',
    tip: 'A deer tag lets you take one deer. States set how many tags you can buy to keep herds healthy. Tag fees help pay for wildlife management.',
  },

  // Weapons
  {
    id: 'rifle-22',
    name: '.22 LR Rifle',
    category: 'weapon',
    price: 150,
    unique: true,
    requires: ['hunting-license'],
    weapon: { kind: 'rimfire', ammo: 'ammo-22', rangeYards: 75, sway: 10, firearm: true },
    summary: 'Small game. Quiet, cheap to shoot.',
    tip: 'The .22 Long Rifle is the classic first gun: little recoil, cheap ammo. It is right for squirrels and rabbits. It is too small for deer, and most states ban rimfire for deer.',
  },
  {
    id: 'shotgun-20',
    name: '20-Gauge Shotgun',
    category: 'weapon',
    price: 220,
    unique: true,
    requires: ['hunting-license'],
    weapon: { kind: 'shotgun', ammo: 'ammo-turkey', rangeYards: 40, sway: 14, firearm: true },
    summary: 'Turkeys and moving small game.',
    tip: 'A shotgun fires a spread of pellets, so it works on moving or small targets. Keep shots inside about 40 yards. For turkeys, use turkey loads and aim at the head and neck.',
  },
  {
    id: 'rifle-308',
    name: '.308 Win Rifle',
    category: 'weapon',
    price: 550,
    unique: true,
    requires: ['hunting-license'],
    weapon: { kind: 'centerfire', ammo: 'ammo-308', rangeYards: 250, sway: 12, firearm: true },
    summary: 'Deer. Long range, needs a steady hold.',
    tip: 'The .308 Winchester is a popular deer cartridge. Like the .270 and .30-06, it has enough energy for a clean, ethical deer harvest. Aim just behind the front shoulder.',
  },
  {
    id: 'bow',
    name: 'Compound Bow',
    category: 'weapon',
    price: 450,
    unique: true,
    requires: ['hunting-license'],
    weapon: { kind: 'bow', ammo: 'arrows-broadhead', rangeYards: 40, sway: 8, firearm: false },
    summary: 'Deer and turkey. Quiet, short range.',
    tip: 'Bowhunting means getting close, usually inside 40 yards. Archery seasons are often longer, and you can skip the blaze orange during archery-only seasons in many states.',
  },

  // Ammo
  {
    id: 'ammo-22',
    name: '.22 LR Ammo (box of 50)',
    category: 'ammo',
    price: 8,
    packSize: 50,
    summary: 'For the .22 rifle.',
    tip: 'Always match ammo to your firearm. The caliber is stamped on the barrel and printed on the box. Wrong ammo can damage the gun or hurt you.',
  },
  {
    id: 'ammo-turkey',
    name: 'Turkey Loads (box of 10)',
    category: 'ammo',
    price: 18,
    packSize: 10,
    summary: 'For the 20-gauge. Dense pellet pattern.',
    tip: 'Turkey loads pack heavy pellets into a tight pattern. Pattern your shotgun at a target first, so you know how far it throws a killing pattern.',
  },
  {
    id: 'ammo-308',
    name: '.308 Win Ammo (box of 20)',
    category: 'ammo',
    price: 35,
    packSize: 20,
    summary: 'For the .308 rifle.',
    tip: 'Hunting bullets expand on impact and are built for a clean kill. Target ammo (full metal jacket) is not for hunting, and some states ban it for big game.',
  },
  {
    id: 'arrows-broadhead',
    name: 'Arrows with Broadheads (6)',
    category: 'ammo',
    price: 30,
    packSize: 6,
    summary: 'For the bow.',
    tip: 'Broadheads have sharp blades for hunting. Field points are blunt practice tips only. Never hunt with field points.',
  },

  // Gear
  {
    id: 'knife',
    name: 'Fixed-Blade Knife',
    category: 'gear',
    price: 25,
    unique: true,
    summary: 'Field dress your harvest.',
    tip: 'Field dress soon after the harvest so the meat cools fast and stays good. A fixed blade is strong and easy to clean. Without a knife, much of the harvest is wasted.',
  },
  {
    id: 'orange-vest',
    name: 'Blaze Orange Vest',
    category: 'gear',
    price: 15,
    unique: true,
    summary: 'Be seen by other hunters.',
    tip: 'Most states require blaze orange during firearm deer season, so other hunters can see you. Deer see colors differently from people, so orange does not scare them much.',
  },
  {
    id: 'binoculars',
    name: 'Binoculars',
    category: 'gear',
    price: 120,
    unique: true,
    summary: 'See far animals clearly (B).',
    tip: '"Glass before you move." Scan with binoculars to find and identify game before it sees you. Never use your rifle scope to look at things you are not ready to shoot.',
  },
  {
    id: 'scent-spray',
    name: 'Scent Eliminator (5 uses)',
    category: 'gear',
    price: 12,
    packSize: 5,
    summary: 'Shrinks your scent cone for a day.',
    tip: 'A deer\'s nose is its best defense. Scent spray helps, but nothing beats keeping the wind in your face. Spray is used up at the start of each hunt.',
  },
  {
    id: 'grunt-call',
    name: 'Deer Grunt Call',
    category: 'gear',
    price: 20,
    unique: true,
    summary: 'Pull curious deer closer (C).',
    tip: 'A grunt call copies the sound bucks make. Call softly and not too often. Too much calling makes deer suspicious.',
  },
  {
    id: 'box-call',
    name: 'Turkey Box Call',
    category: 'gear',
    price: 25,
    unique: true,
    summary: 'Call turkeys in (C).',
    tip: 'A box call makes hen yelps by sliding the lid over the box. Gobblers come looking for the hen. Never wear red, white or blue turkey hunting: those are the colors of a gobbler\'s head.',
  },
  {
    id: 'harness',
    name: 'Full-Body Safety Harness',
    category: 'gear',
    price: 60,
    unique: true,
    summary: 'Required to use a tree stand.',
    tip: 'Falls from tree stands are one of the most common causes of hunting injuries. Wear a full-body harness and stay attached from the moment you leave the ground.',
  },
  {
    id: 'tree-stand',
    name: 'Hang-On Tree Stand',
    category: 'gear',
    price: 150,
    unique: true,
    requires: ['harness'],
    summary: 'Hunt from above (T).',
    tip: 'Up high, you are out of a deer\'s line of sight, and your scent tends to carry over them. Always use a haul line to pull up your gun or bow. Never climb holding it.',
  },

  // Loot (sold, not bought)
  {
    id: 'squirrel-tail',
    name: 'Squirrel Tail',
    category: 'loot',
    sellPrice: 6,
    summary: 'Used to make fishing lures.',
    tip: 'Some fishing lure makers buy squirrel tails to tie the hair on spinners. Very little of the animal needs to go to waste.',
  },
  {
    id: 'rabbit-pelt',
    name: 'Rabbit Pelt',
    category: 'loot',
    sellPrice: 12,
    summary: 'Soft fur for crafts.',
    tip: 'Rabbit fur is used for fly-tying and crafts. Rabbits are a great first animal for learning to field dress.',
  },
  {
    id: 'turkey-feathers',
    name: 'Turkey Feathers',
    category: 'loot',
    sellPrice: 18,
    summary: 'Fletching and crafts.',
    tip: 'Turkey feathers were the traditional arrow fletching. Check your state\'s rules before selling any wildlife parts.',
  },
  {
    id: 'deer-hide',
    name: 'Deer Hide',
    category: 'loot',
    sellPrice: 35,
    summary: 'Tanned into leather.',
    tip: 'Deer hides become gloves and jackets. Salt the hide soon after skinning to keep it from spoiling.',
  },
  {
    id: 'antlers',
    name: 'Antler Rack',
    category: 'loot',
    sellPrice: 90,
    summary: 'From a harvested buck.',
    tip: 'Antlers grow back every year. Bucks shed them in late winter and grow a new set over summer.',
  },
  {
    id: 'shed-antler',
    name: 'Shed Antler',
    category: 'loot',
    sellPrice: 30,
    summary: 'Found on the ground.',
    tip: 'Shed hunting means looking for dropped antlers in late winter and spring. It is a great way to learn where deer live, and it needs no license in most places.',
  },
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown item: ${id}`);
  return def;
}

export function weaponItems(): ItemDef[] {
  return ITEMS.filter((i) => i.weapon);
}
