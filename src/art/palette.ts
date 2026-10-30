/**
 * Time-of-day color grading. Far layers are drawn in grayscale and tinted with
 * `layers` (farthest first), so the forest fades into the sky like real haze.
 * Near layers and characters are drawn in full color and multiplied by `light`.
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
  { hour: 0, skyTop: 0x0b1026, skyBottom: 0x26304f, layers: [0x2a3354, 0x232b47, 0x1c233b, 0x161c30, 0x10152a], light: 0x56608c, mist: 0x3a4468, mistAlpha: 0.25 },
  { hour: 5.5, skyTop: 0x101838, skyBottom: 0x3a3a62, layers: [0x3e4068, 0x33355a, 0x292b4c, 0x20223e, 0x181a32], light: 0x5e6694, mist: 0x50567e, mistAlpha: 0.35 },
  { hour: 6.3, skyTop: 0x253063, skyBottom: 0xb07a8a, layers: [0x7e6788, 0x63557a, 0x4c4566, 0x393652, 0x2a2840], light: 0x9a8cb4, mist: 0xc9a5b5, mistAlpha: 0.5 },
  { hour: 7.2, skyTop: 0x4a6aa6, skyBottom: 0xf6b178, layers: [0xc9958a, 0xa2767c, 0x7f5e6d, 0x5e475a, 0x413447], light: 0xffd2a8, mist: 0xf7d0b0, mistAlpha: 0.55 },
  { hour: 9, skyTop: 0x5e94cf, skyBottom: 0xd4e6ea, layers: [0x9ab8c6, 0x7d9fae, 0x62838f, 0x4c6a6e, 0x3a524f], light: 0xfff6e8, mist: 0xe8f0f0, mistAlpha: 0.3 },
  { hour: 13, skyTop: 0x4f8fd6, skyBottom: 0xc4e2ee, layers: [0xa2c3d2, 0x84aaba, 0x678d9c, 0x51737a, 0x3d5a5a], light: 0xffffff, mist: 0xe8f2f6, mistAlpha: 0.12 },
  { hour: 16.5, skyTop: 0x5d82c4, skyBottom: 0xf1d29a, layers: [0xc7b79c, 0xa69886, 0x857b70, 0x655e59, 0x484345], light: 0xffe6b8, mist: 0xf5dfb8, mistAlpha: 0.2 },
  { hour: 18.2, skyTop: 0x3b3f7a, skyBottom: 0xf28c5a, layers: [0xc0706c, 0x985a66, 0x744859, 0x55374b, 0x3a283b], light: 0xf5a77f, mist: 0xf0a080, mistAlpha: 0.35 },
  { hour: 19.2, skyTop: 0x161d42, skyBottom: 0x5a3f6a, layers: [0x473e68, 0x393358, 0x2d2949, 0x23203b, 0x19172e], light: 0x6e6a9c, mist: 0x5a4f7e, mistAlpha: 0.35 },
  { hour: 24, skyTop: 0x0b1026, skyBottom: 0x26304f, layers: [0x2a3354, 0x232b47, 0x1c233b, 0x161c30, 0x10152a], light: 0x56608c, mist: 0x3a4468, mistAlpha: 0.25 },
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
