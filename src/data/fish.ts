import type { FishDef, FlyType } from '../core/types';

export const FISH: FishDef[] = [
  {
    id: 'rainbow',
    name: 'Rainbow Trout',
    minIn: 9,
    maxIn: 20,
    keepMinIn: 12,
    likes: { mayfly: 1, caddis: 1, nymph: 1, streamer: 0.6 },
    fieldGuide: [
      'A pink stripe down the side and small black spots.',
      'Often feeds in faster water, in the seams between fast and slow current.',
      'Many rivers are stocked with rainbows from hatcheries.',
    ],
  },
  {
    id: 'brown',
    name: 'Brown Trout',
    minIn: 11,
    maxIn: 24,
    keepMinIn: 14,
    likes: { mayfly: 0.7, caddis: 0.8, nymph: 0.9, streamer: 1.4 },
    fieldGuide: [
      'Golden-brown with black and red spots ringed in pale halos.',
      'Wary and often nocturnal. The biggest ones hunt small fish at dawn and dusk.',
      'Hides under cut banks and logs. Keep low and quiet.',
    ],
  },
  {
    id: 'brook',
    name: 'Brook Trout',
    minIn: 6,
    maxIn: 13,
    keepMinIn: 8,
    likes: { mayfly: 1.2, caddis: 1.2, nymph: 0.9, streamer: 0.5 },
    fieldGuide: [
      'Wormy marks on the back, red spots with blue halos, white-edged fins.',
      'Needs cold, clean water. Finding brook trout means a healthy stream.',
      'Technically a char, not a true trout.',
    ],
  },
];

export function fish(id: string): FishDef {
  const def = FISH.find((f) => f.id === id);
  if (!def) throw new Error(`Unknown fish: ${id}`);
  return def;
}

/** Fly item id to the kind of food it imitates. */
export const FLIES: Record<string, FlyType> = {
  'fly-adams': 'mayfly',
  'fly-caddis': 'caddis',
  'fly-nymph': 'nymph',
  'fly-streamer': 'streamer',
};

/** Daily trout limit (fish kept, not released). */
export const TROUT_LIMIT = 2;
