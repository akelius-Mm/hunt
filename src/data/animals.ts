import type { AnimalDef, ZoneRect } from '../core/types';

// Hit zones are in sprite pixel coordinates (see src/art/sprites.ts), sprite facing right.
// tests/core.test.ts checks each zone covers the pixels it should.
// They are checked in this order: head, vitals, legs, body. Anything else is a miss.

const DEER_ZONES: ZoneRect[] = [
  { zone: 'head', x0: 20, y0: 0, x1: 31, y1: 11 },
  { zone: 'vitals', x0: 16, y0: 13, x1: 21, y1: 18 },
  { zone: 'legs', x0: 2, y0: 21, x1: 29, y1: 25 },
  { zone: 'body', x0: 1, y0: 12, x1: 24, y1: 20 },
];

const DEER_COMMON = {
  areas: ['ridge'],
  tag: 'deer-tag',
  legalAmmo: ['ammo-308', 'arrows-broadhead'],
  cleanZones: { centerfire: ['vitals'], bow: ['vitals'] },
  sightYards: 70,
  hearingYards: 90,
  scentYards: 160,
  walkSpeed: 7,
  fleeSpeed: 65,
  activity: { dawn: 1, day: 0.25, dusk: 1 },
  meatLbs: 50,
  meatName: 'Venison',
  zones: DEER_ZONES,
} satisfies Partial<AnimalDef>;

export const ANIMALS: AnimalDef[] = [
  {
    id: 'squirrel',
    name: 'Gray Squirrel',
    areas: ['woodlot', 'ridge'],
    legalAmmo: ['ammo-22', 'ammo-turkey'],
    cleanZones: { rimfire: ['head', 'vitals'], shotgun: ['head', 'vitals', 'body'] },
    fairZones: { rimfire: ['body'] },
    sightYards: 35,
    hearingYards: 35,
    scentYards: 10,
    walkSpeed: 11,
    fleeSpeed: 55,
    activity: { dawn: 1, day: 0.6, dusk: 0.7 },
    loot: [{ item: 'squirrel-tail', qty: 1, chance: 1 }],
    meatLbs: 1,
    meatName: 'Squirrel',
    zones: [
      { zone: 'head', x0: 8, y0: 1, x1: 14, y1: 5 },
      { zone: 'vitals', x0: 8, y0: 6, x1: 10, y1: 8 },
      { zone: 'legs', x0: 4, y0: 10, x1: 12, y1: 11 },
      { zone: 'body', x0: 5, y0: 5, x1: 12, y1: 9 },
    ],
    fieldGuide: [
      'Most active in the first hours after sunrise.',
      'Listen for falling nut shells and rustling leaves under oaks and hickories.',
      'A good first animal: the season is long and a .22 is all you need.',
    ],
  },
  {
    id: 'rabbit',
    name: 'Cottontail Rabbit',
    areas: ['woodlot'],
    legalAmmo: ['ammo-22', 'ammo-turkey'],
    cleanZones: { rimfire: ['head', 'vitals'], shotgun: ['head', 'vitals', 'body'] },
    fairZones: { rimfire: ['body'] },
    sightYards: 25,
    hearingYards: 30,
    scentYards: 15,
    walkSpeed: 9,
    fleeSpeed: 70,
    activity: { dawn: 1, day: 0.4, dusk: 1 },
    loot: [{ item: 'rabbit-pelt', qty: 1, chance: 1 }],
    meatLbs: 2,
    meatName: 'Rabbit',
    zones: [
      { zone: 'head', x0: 7, y0: 0, x1: 13, y1: 5 },
      { zone: 'vitals', x0: 7, y0: 6, x1: 10, y1: 8 },
      { zone: 'legs', x0: 1, y0: 9, x1: 11, y1: 10 },
      { zone: 'body', x0: 0, y0: 4, x1: 12, y1: 8 },
    ],
    fieldGuide: [
      'Lives on edges: where brush and brambles meet open fields.',
      'Freezes first and bolts at the last moment, often in a zig-zag.',
      'Feeds at dawn and dusk.',
    ],
  },
  {
    id: 'turkey',
    name: 'Wild Turkey (Gobbler)',
    areas: ['woodlot', 'ridge'],
    tag: 'turkey-tag',
    legalAmmo: ['ammo-turkey', 'arrows-broadhead'],
    cleanZones: { shotgun: ['head'], bow: ['vitals'] },
    sightYards: 90,
    hearingYards: 60,
    scentYards: 10,
    walkSpeed: 8,
    fleeSpeed: 60,
    activity: { dawn: 1, day: 0.5, dusk: 0.4 },
    loot: [{ item: 'turkey-feathers', qty: 1, chance: 1 }],
    meatLbs: 12,
    meatName: 'Wild Turkey',
    zones: [
      { zone: 'head', x0: 13, y0: 0, x1: 19, y1: 6 },
      { zone: 'vitals', x0: 11, y0: 9, x1: 14, y1: 12 },
      { zone: 'legs', x0: 5, y0: 16, x1: 14, y1: 19 },
      { zone: 'body', x0: 5, y0: 6, x1: 17, y1: 15 },
    ],
    fieldGuide: [
      'Superb eyesight, but a weak sense of smell. Stay still, wind matters less.',
      'Gobbles from the roost at first light, then flies down to look for hens.',
      'With a shotgun, aim at the head and neck. Feathers stop pellets on the body.',
    ],
  },
  {
    id: 'mallard',
    name: 'Mallard (Drake)',
    areas: ['marsh'],
    permits: ['duck-stamp'],
    bagLimit: 4,
    endsAtSunset: true,
    waterfowl: true,
    legalAmmo: ['ammo-steel'],
    // A shot pattern covers the whole bird, so any solid hit is clean.
    cleanZones: { shotgun: ['head', 'vitals', 'body'] },
    sightYards: 70,
    hearingYards: 45,
    scentYards: 5,
    walkSpeed: 3,
    fleeSpeed: 40,
    activity: { dawn: 1, day: 0.35, dusk: 0.8 },
    loot: [{ item: 'duck-feathers', qty: 1, chance: 1 }],
    meatLbs: 2,
    meatName: 'Duck',
    zones: [{ zone: 'body', x0: 0, y0: 0, x1: 17, y1: 9 }],
    fieldGuide: [
      'Drakes have a green head and white neck ring. Hens are mottled brown. Know what you are shooting.',
      'Ducks fly at dawn from roosting water to feed. Set up before first light.',
      'Lead the bird: swing the barrel through it and shoot a little ahead.',
    ],
  },
  {
    ...DEER_COMMON,
    id: 'buck',
    name: 'Whitetail Buck',
    loot: [
      { item: 'deer-hide', qty: 1, chance: 1 },
      { item: 'antlers', qty: 1, chance: 1 },
    ],
    fieldGuide: [
      'Moves most at dawn and dusk, along edges and trails between bedding and food.',
      'Its nose is its best defense. Always hunt with the wind in your face.',
      'Aim just behind the front shoulder, a third of the way up: heart and lungs.',
    ],
  },
  {
    ...DEER_COMMON,
    id: 'doe',
    name: 'Whitetail Doe',
    loot: [{ item: 'deer-hide', qty: 1, chance: 1 }],
    fieldGuide: [
      'Does often travel in family groups. The lead doe is the most alert.',
      'Harvesting does helps keep deer herds balanced with their habitat.',
      'Same vital zone as a buck: just behind the front shoulder.',
    ],
  },
];

const BY_ID = new Map(ANIMALS.map((a) => [a.id, a]));

export function animal(id: string): AnimalDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown animal: ${id}`);
  return def;
}

export interface AreaDef {
  id: string;
  /** Open water with reflections, where ducks fly in. */
  lake?: boolean;
  name: string;
  description: string;
  /** Animal id -> spawn weight. */
  spawns: Record<string, number>;
  hasSheds: boolean;
  /** True during firearm deer season: blaze orange is required with a firearm. */
  orangeRequired: boolean;
}

export const AREAS: AreaDef[] = [
  {
    id: 'woodlot',
    name: 'Oak Woodlot',
    description: 'Oaks, brush piles and field edges. Squirrels, rabbits and turkeys.',
    spawns: { squirrel: 4, rabbit: 4, turkey: 1 },
    hasSheds: false,
    orangeRequired: false,
  },
  {
    id: 'marsh',
    name: 'Cattail Marsh',
    description: 'Open water ringed by cattails. Mallards fly in at first light. Duck season is open.',
    lake: true,
    spawns: { mallard: 1 },
    hasSheds: false,
    orangeRequired: false,
  },
  {
    id: 'ridge',
    name: 'Ridge Hardwoods',
    description: 'Deer trails along a wooded ridge. It is firearm deer season here.',
    spawns: { doe: 3, buck: 2, turkey: 1, squirrel: 2 },
    hasSheds: true,
    orangeRequired: true,
  },
];

export function area(id: string): AreaDef {
  const def = AREAS.find((a) => a.id === id);
  if (!def) throw new Error(`Unknown area: ${id}`);
  return def;
}
