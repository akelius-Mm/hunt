# Hunt: Field & Lessons

A cozy 2D side-view hunting game that teaches real hunting basics as you play.
You learn by doing: buying the right gear, following the rules, reading the wind
and placing a clean, ethical shot.

> This game teaches common US hunting practice. Real seasons, limits and rules
> differ by state. Always check your state wildlife agency before you hunt.
> "Trailhead Outfitters" is a made-up store, not linked to any real retailer.

## Play

```bash
npm install
npm run dev      # open the printed localhost URL
```

Other commands: `npm test` (unit tests for the game rules), `npm run build` (static site in `dist/`).

## How it teaches

| You learn | How the game teaches it |
|---|---|
| Hunter education | A quiz at camp. You must pass it before you can buy a license. |
| Licenses and tags | No license, no shot. Deer and turkeys each need a tag, and a tag is used up per animal. |
| Gear | Ask Mae, the outfitter clerk, about any item: what it's for and when to use it. |
| Right tool for the game | A .22 can't be used on deer. Turkeys need turkey loads or broadheads. Each weapon has an effective range. |
| Wind and scent | A visible scent cone drifts downwind. Animals that smell, hear or see you run off, and you get a lesson card telling you why. |
| Shot placement | Each animal has hit zones. Vitals give a clean harvest. Other hits wound the animal and teach you where to aim. |
| Legal shooting hours | The day starts before legal light, and you can't shoot until it begins. |
| Safety | Blaze orange in firearm deer season (or the warden fines you), and a harness for tree stands. |
| After the shot | Tag, field dress (bring a knife!), keep or donate the meat. Wild game meat can't be sold. |

Lesson cards are collected in the journal, so you can track how much you've learned.

## Economy

- **Outfitter:** buy gear, sell hides, tails, feathers and antlers. Prices drop as you sell more of the same thing and recover each day.
- **Old Hollis:** a trapper who barters used gear for hides and pelts. His stock rotates daily, and he gets less greedy each time you trade.
- **Donations:** donating meat builds community reputation, which gives up to 15% off at the outfitter.

## Controls

A / D: walk · Shift: run (loud) · S: crouch · F or right-click: aim · Space (hold): hold breath ·
Left-click: shoot · E: tag / pick up · B: binoculars · C: call · T: tree stand · Q: switch weapon · Esc: back to camp

## Code layout

```
src/
  core/      game rules in plain TypeScript, no Phaser (tested in tests/)
  data/      items, animals, lessons and quiz: edit these to add content
  scenes/    Phaser scenes: camp backdrop and the hunt
  ui/        HTML menus: outfitter, trader, journal, quiz, lesson cards
  art/       pixel-art sprites and scenery, drawn from code
```
