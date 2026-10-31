/**
 * Time-of-day color grading. Everything is drawn in full color and multiplied by
 * `light`. Far layers are also veiled with their `layers` haze color (farthest
 * first), so the forest fades into the distance like real air does.
 */
export interface Grade {
  hour: number;
  skyTop: number;
  skyBottom: number;
  layers: [number, number, number, number, number];
  light: number;
  mist: number;
  mistAlpha: number;
}

export const GRADES: Grade[] = [
  { hour: 0, skyTop: 0x0b1026, skyBottom: 0x26304f, layers: [0x2a3354, 0x232b47, 0x1c233b, 0x161c30, 0x10152a], light: 0x4a5482, mist: 0x3a4468, mistAlpha: 0.25 },
  { hour: 5.5, skyTop: 0x101838, skyBottom: 0x3a3a62, layers: [0x3e4068, 0x33355a, 0x292b4c, 0x20223e, 0x181a32], light: 0x545c8c, mist: 0x50567e, mistAlpha: 0.35 },
  { hour: 6.3, skyTop: 0x253063, skyBottom: 0xc08a8a, layers: [0x9a7a9a, 0x80688a, 0x685878, 0x524866, 0x3e3852], light: 0xa898b8, mist: 0xd8b0b8, mistAlpha: 0.5 },
  { hour: 7.2, skyTop: 0x4a6aa6, skyBottom: 0xf8bc80, layers: [0xe8b4a0, 0xd8a090, 0xc08a80, 0xa87870, 0x8a6460], light: 0xffd8b0, mist: 0xfad8b8, mistAlpha: 0.55 },
  { hour: 9, skyTop: 0x5a92d4, skyBottom: 0xf4e4c0, layers: [0xc4cce0, 0xb4bed6, 0xa4b0cc, 0x94a2c0, 0x8494b4], light: 0xfff0d8, mist: 0xf6ecd8, mistAlpha: 0.3 },
  { hour: 13, skyTop: 0x5090dc, skyBottom: 0xe8ecdc, layers: [0xbcc8e0, 0xaebcd8, 0xa0b0cc, 0x92a4c0, 0x8498b4], light: 0xfff8ea, mist: 0xf4f0e2, mistAlpha: 0.12 },
  { hour: 16.5, skyTop: 0x5a80c8, skyBottom: 0xf8d090, layers: [0xdcc4a8, 0xccb49c, 0xbca48e, 0xa89480, 0x948272], light: 0xffe4b0, mist: 0xf8dfb0, mistAlpha: 0.22 },
  { hour: 18.2, skyTop: 0x3b3f7a, skyBottom: 0xf28c5a, layers: [0xd08878, 0xb8746e, 0x9e6264, 0x845258, 0x6a424c], light: 0xf6a878, mist: 0xf0a080, mistAlpha: 0.35 },
  { hour: 19.2, skyTop: 0x161d42, skyBottom: 0x5a3f6a, layers: [0x473e68, 0x393358, 0x2d2949, 0x23203b, 0x19172e], light: 0x6a6698, mist: 0x5a4f7e, mistAlpha: 0.35 },
  { hour: 24, skyTop: 0x0b1026, skyBottom: 0x26304f, layers: [0x2a3354, 0x232b47, 0x1c233b, 0x161c30, 0x10152a], light: 0x4a5482, mist: 0x3a4468, mistAlpha: 0.25 },
];

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

export function gradeAt(hour: number): Grade {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < GRADES.length - 2 && GRADES[i + 1].hour <= h) i++;
  const a = GRADES[i];
  const b = GRADES[i + 1];
  const t = (h - a.hour) / (b.hour - a.hour);
  return {
    hour: h,
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    layers: a.layers.map((c, n) => lerpColor(c, b.layers[n], t)) as Grade['layers'],
    light: lerpColor(a.light, b.light, t),
    mist: lerpColor(a.mist, b.mist, t),
    mistAlpha: a.mistAlpha + (b.mistAlpha - a.mistAlpha) * t,
  };
}

/** 0 in daylight, 1 at full night. */
export function nightness(hour: number): number {
  if (hour < 5.5 || hour > 19.6) return 1;
  if (hour < 6.8) return (6.8 - hour) / 1.3;
  if (hour > 18.4) return (hour - 18.4) / 1.2;
  return 0;
}

/** 1 around sunrise and sunset, 0 at midday. */
export function golden(hour: number): number {
  return Math.max(0, 1 - Math.abs(hour - 7.2) / 1.4, 1 - Math.abs(hour - 17.8) / 1.4);
}
