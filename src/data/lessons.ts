import type { Lesson, QuizQuestion } from '../core/types';

export const LESSONS: Lesson[] = [
  { id: 'welcome', title: 'Rules vary by place', text: 'This game teaches common US hunting practice. Real seasons, limits and rules differ by state. Always check your state wildlife agency before you hunt.' },
  { id: 'no-license', title: 'License first', text: 'You cannot legally take any game without a hunting license. Pass hunter education at camp, then buy a license at the outfitter.' },
  { id: 'no-tag', title: 'No tag, no harvest', text: 'Deer and turkeys need a tag for each animal. Without one, the shot is poaching. Buy tags at the outfitter.' },
  { id: 'wrong-weapon', title: 'Right tool for the game', text: 'Each animal needs a suitable weapon and ammo. Too little power wounds; some combinations are also illegal, like rimfire on deer.' },
  { id: 'out-of-range', title: 'Know your effective range', text: 'Only shoot inside the range where you can reliably hit the vital zone. Close the distance, or let the animal walk.' },
  { id: 'shooting-hours', title: 'Legal shooting hours', text: 'Legal shooting light usually starts about 30 minutes before sunrise and ends about 30 minutes after sunset. Outside those times, you may not shoot.' },
  { id: 'no-ammo', title: 'Check your gear', text: 'Out of ammo. Before each hunt, check you have the right ammo for the weapon you carry.' },
  { id: 'orange', title: 'Blaze orange saves lives', text: 'During firearm deer season, most states require blaze orange so other hunters can see you. The warden wrote you a fine.' },
  { id: 'scent', title: 'Hunt into the wind', text: 'The animal smelled you. Your scent drifts downwind. Keep the wind blowing from the animal toward you.' },
  { id: 'sound', title: 'Slow and quiet', text: 'The animal heard you. Running crunches leaves. Walk slowly, or crouch (S) to sneak.' },
  { id: 'sight', title: 'Movement gives you away', text: 'The animal saw you move. Stop when it looks up, crouch, and move only when it looks away or feeds.' },
  { id: 'wounded', title: 'Shot placement matters', text: 'The animal was hit, but not in the vitals, and ran off wounded. Aim just behind the front shoulder (heart and lungs). Wait for a broadside shot.' },
  { id: 'turkey-head', title: 'Turkey: aim for the head', text: 'Shotgun pellets bounce off a turkey\'s thick feathers. Aim at the head and neck.' },
  { id: 'head-risk', title: 'Avoid head shots on deer', text: 'A deer\'s head is small and moves a lot. A miss can break the jaw and leave the animal to suffer. The heart-lung area is larger and more forgiving.' },
  { id: 'miss', title: 'Missed', text: 'The shot missed. Hold your breath (hold Shift) to steady the reticle, and wait for the animal to stand still.' },
  { id: 'clean-harvest', title: 'Clean harvest', text: 'A good, ethical shot. Walk up, press E to tag the animal and field dress it.' },
  { id: 'no-knife', title: 'Bring a knife', text: 'Without a knife you could not field dress in time. The meat was saved, but the hide and parts were lost.' },
  { id: 'gunshot', title: 'Shots carry far', text: 'A gunshot spooks every animal nearby. Make your first shot count.' },
  { id: 'harness', title: 'Never climb without a harness', text: 'You need a full-body safety harness to use a tree stand. Tree stand falls are a leading cause of hunting injuries.' },
  { id: 'tree-stand', title: 'Above their eyes', text: 'From a tree stand, animals are less likely to see you, and your scent carries over them. You can\'t move, so pick a spot near a trail.' },
  { id: 'call', title: 'Calling', text: 'Calls make curious animals come toward you. Call softly and not too often.' },
  { id: 'shed', title: 'Shed antlers', text: 'You found a shed antler. Bucks drop their antlers each winter and grow new ones.' },
  { id: 'meat', title: 'Meat stays with you', text: 'Selling wild game meat is illegal in most of the US. You keep it, or donate it at camp through a hunters-for-the-hungry program.' },
  { id: 'donate', title: 'Sharing the harvest', text: 'Donated venison feeds families in need. Many states and processors run donation programs.' },
  { id: 'binoculars', title: 'Glass first', text: 'Binoculars let you spot and identify animals far away before they spot you.' },
];

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function lesson(id: string): Lesson {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown lesson: ${id}`);
  return def;
}

/** Hunter education quiz. Pass with PASS_SCORE correct answers. */
export const QUIZ: QuizQuestion[] = [
  {
    q: 'What is the first rule of firearm safety?',
    options: ['Keep the safety on at all times', 'Treat every firearm as if it is loaded', 'Only load at the truck'],
    answer: 1,
    why: 'Treat every firearm as loaded, even if you just checked it. The other rules build on this one.',
  },
  {
    q: 'Before you shoot, what must you be sure of?',
    options: ['Your target and what is beyond it', 'That the animal is the biggest one', 'That nobody is watching'],
    answer: 0,
    why: 'Bullets can travel more than a mile. Know your target, and what is behind and around it.',
  },
  {
    q: 'Where should your finger be until you are ready to shoot?',
    options: ['Resting on the trigger', 'Outside the trigger guard', 'On the safety'],
    answer: 1,
    why: 'Keep your finger outside the trigger guard until your sights are on the target and you have decided to shoot.',
  },
  {
    q: 'Where is the best aiming point on a broadside deer?',
    options: ['The head', 'The middle of the body', 'Just behind the front shoulder'],
    answer: 2,
    why: 'Behind the front shoulder are the heart and lungs: a large target that gives a quick, humane harvest.',
  },
  {
    q: 'Which way should the wind blow when you approach a deer?',
    options: ['From the deer toward you', 'From you toward the deer', 'It does not matter'],
    answer: 0,
    why: 'Deer rely on smell. With the wind in your face, your scent blows away from them.',
  },
  {
    q: 'What must you wear when hunting from a tree stand?',
    options: ['Blaze orange gloves', 'A full-body safety harness', 'Rubber boots'],
    answer: 1,
    why: 'A full-body harness, attached from the moment you leave the ground until you are back down.',
  },
  {
    q: 'Why do most states require blaze orange in firearm deer season?',
    options: ['It scares deer toward you', 'So other hunters can see you', 'It hides your scent'],
    answer: 1,
    why: 'Blaze orange makes you visible to other hunters. Deer see it as a dull color, so it does not scare them much.',
  },
  {
    q: 'What do you do right after a legal deer harvest?',
    options: ['Drag it to the truck, then tag it', 'Tag it, then field dress it', 'Take photos for an hour'],
    answer: 1,
    why: 'Most states require you to tag the animal before moving it. Then field dress it so the meat cools quickly.',
  },
];

export const PASS_SCORE = 6;
