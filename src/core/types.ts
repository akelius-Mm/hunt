export type ItemCategory = 'license' | 'weapon' | 'ammo' | 'gear' | 'loot';

export type WeaponKind = 'rimfire' | 'shotgun' | 'centerfire' | 'bow';

export interface WeaponStats {
  kind: WeaponKind;
  /** Item id of the ammunition this weapon uses. */
  ammo: string;
  /** Effective, ethical range in yards. */
  rangeYards: number;
  /** How much the reticle sways (pixels). Lower is steadier. */
  sway: number;
  firearm: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  /** Price at the outfitter. Undefined means the outfitter doesn't sell it. */
  price?: number;
  /** Base price the outfitter pays. Undefined means it can't be sold. */
  sellPrice?: number;
  /** How many units one purchase gives (a box of ammo, a can of spray). */
  packSize?: number;
  /** Items you must own (or a flag like hunter-ed) before buying. */
  requires?: string[];
  /** One-off items you can only own one of. */
  unique?: boolean;
  weapon?: WeaponStats;
  /** Short line shown in the shop list. */
  summary: string;
  /** What the clerk teaches you about this item. */
  tip: string;
}

export type Zone = 'head' | 'vitals' | 'body' | 'legs';

export interface ZoneRect {
  zone: Zone;
  /** Sprite pixel coordinates, sprite facing right. Inclusive. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type TimeOfDay = 'dawn' | 'day' | 'dusk';

export interface LootDrop {
  item: string;
  qty: number;
  /** 0..1 */
  chance: number;
}

export interface AnimalDef {
  id: string;
  name: string;
  areas: string[];
  /** Item id of the tag needed to harvest, if any. */
  tag?: string;
  /** Ammo ids that are legal and ethical for this animal. */
  legalAmmo: string[];
  /** For this animal and weapon kind, which zone gives a clean harvest. */
  cleanZones: Partial<Record<WeaponKind, Zone[]>>;
  /** Zones that still harvest the animal, but at lower quality. */
  fairZones?: Partial<Record<WeaponKind, Zone[]>>;
  sightYards: number;
  hearingYards: number;
  scentYards: number;
  walkSpeed: number;
  fleeSpeed: number;
  activity: Record<TimeOfDay, number>;
  loot: LootDrop[];
  /** Pounds of meat for the freezer. */
  meatLbs: number;
  meatName: string;
  zones: ZoneRect[];
  fieldGuide: string[];
}

export interface Lesson {
  id: string;
  title: string;
  text: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export type Quality = 'Prime' | 'Good' | 'Fair';

export interface Harvest {
  day: number;
  animal: string;
  quality: Quality;
  weapon: string;
}

export interface GameState {
  version: 1;
  day: number;
  money: number;
  inventory: Record<string, number>;
  equippedWeapon: string | null;
  hunterEd: boolean;
  /** Community reputation, earned by donating meat. Gives outfitter discounts. */
  reputation: number;
  /** How much the trader likes you. Makes him less greedy. */
  traderRep: number;
  /** Per-item demand multiplier at the outfitter, 0.4..1. */
  demand: Record<string, number>;
  /** Pounds of meat per meat name. */
  freezer: Record<string, number>;
  seenAnimals: string[];
  lessons: string[];
  harvests: Harvest[];
  traderStock: Record<string, number>;
}
