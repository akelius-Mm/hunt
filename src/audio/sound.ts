/**
 * All game audio, synthesized with the Web Audio API: no sound files, so the game stays
 * small and works offline. Three layers, each with its own volume:
 * - ambience: wind, birdsong, water, fire, crickets at night
 * - music: a slow fingerpicked guitar loop (Karplus-Strong plucked strings)
 * - effects: footsteps, casting, reels, splashes, shots, coins
 *
 * Browsers only allow audio after the player touches the screen, so everything stays
 * silent until `unlock()` runs from a touch or key press.
 */

type Ambience = 'camp' | 'forest' | 'creek' | 'marsh' | 'none';

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let ambBus: GainNode;
let noise: AudioBuffer;
let muted = readMuted();
let ambience: Ambience = 'none';
let night = 0;
let ticker: number | undefined;
let musicStarted = false;
let nextBeat = 0;
let beat = 0;
const plucks = new Map<number, AudioBuffer>();
/** Looping ambience nodes for the current place, stopped when the place changes. */
let ambNodes: AudioScheduledSourceNode[] = [];
let nextBird = 0;
let nextCrackle = 0;
let nextCricket = 0;

function readMuted(): boolean {
  try {
    return localStorage.getItem('fg-muted') === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  try {
    localStorage.setItem('fg-muted', muted ? '1' : '0');
  } catch {
    // Private mode: the setting just won't stick.
  }
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
  return muted;
}

/** Call from any touch or key press. Safe to call often. */
export function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = bus(0.32);
    sfxBus = bus(0.8);
    ambBus = bus(0.55);
    noise = makeNoise(ctx, 3);
    const a = ambience;
    ambience = 'none';
    setAmbience(a);
    ticker = window.setInterval(tick, 120);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (!musicStarted) {
    musicStarted = true;
    nextBeat = ctx.currentTime + 0.6;
  }
}

function bus(level: number): GainNode {
  const g = ctx!.createGain();
  g.gain.value = level;
  g.connect(master);
  return g;
}

function makeNoise(c: AudioContext, seconds: number): AudioBuffer {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  // Slightly pink: a running average takes the hiss off.
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
    d[i] = last * 1.6;
  }
  return b;
}

// ---------- Building blocks ----------

function noiseBurst(opts: { at?: number; dur: number; type: BiquadFilterType; freq: number; q?: number; gain: number; attack?: number; sweepTo?: number; out?: AudioNode }): void {
  if (!ctx) return;
  const t = opts.at ?? ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = opts.type;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  const attack = opts.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f).connect(g).connect(opts.out ?? sfxBus);
  src.start(t, Math.random() * 2);
  src.stop(t + opts.dur + 0.05);
}

function tone(opts: { at?: number; freq: number; to?: number; dur: number; gain: number; type?: OscillatorType; attack?: number; out?: AudioNode }): void {
  if (!ctx) return;
  const t = opts.at ?? ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  o.connect(g).connect(opts.out ?? sfxBus);
  o.start(t);
  o.stop(t + opts.dur + 0.05);
}

/** A plucked string (Karplus-Strong), rendered once per pitch and cached. */
function pluckBuffer(freq: number): AudioBuffer {
  const key = Math.round(freq * 10);
  const cached = plucks.get(key);
  if (cached) return cached;
  const sr = ctx!.sampleRate;
  const len = Math.floor(sr * 3);
  const b = ctx!.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  // A soft pick: smooth the initial burst so it sounds like nylon, not steel.
  for (let k = 0; k < 2; k++) for (let i = 1; i < period; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = (ring[idx] + ring[next]) * 0.5 * 0.9965;
    d[i] = ring[idx];
    ring[idx] = v;
    idx = next;
  }
  plucks.set(key, b);
  return b;
}

function pluck(freq: number, at: number, gain: number, out: AudioNode = musicBus): void {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq);
  const g = ctx.createGain();
  g.gain.value = gain;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  src.connect(lp).connect(g).connect(out);
  src.start(at);
  src.stop(at + 3);
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// ---------- Music: a slow fingerpicked loop in G ----------

/** Chords as MIDI notes: bass, then the three notes the fingers pick. */
const CHORDS: [number, number[]][] = [
  [43, [55, 59, 62]], // G
  [40, [55, 59, 64]], // Em
  [36, [55, 60, 64]], // C
  [38, [54, 57, 62]], // D
  [43, [55, 59, 62]], // G
  [45, [57, 60, 64]], // Am
  [36, [55, 60, 64]], // C
  [38, [54, 57, 62]], // D
];
/** Which finger plays on each eighth note of a bar: -1 is the bass. */
const PATTERN = [-1, 1, 2, 1, 0, 1, 2, 1];
/** A simple tune over the top, one note per bar on the first beat or none. */
const MELODY = [71, 0, 72, 74, 71, 72, 0, 69];
const EIGHTH = 60 / 66 / 2;

function scheduleMusic(): void {
  if (!ctx || !musicStarted) return;
  while (nextBeat < ctx.currentTime + 0.4) {
    const bar = Math.floor(beat / 8) % CHORDS.length;
    const step = beat % 8;
    const [bass, fingers] = CHORDS[bar];
    const f = PATTERN[step];
    // A little human timing.
    const at = nextBeat + (Math.random() - 0.5) * 0.012;
    if (f === -1) pluck(NOTE(bass), at, 0.55);
    else pluck(NOTE(fingers[f]), at, 0.3 + Math.random() * 0.06);
    if (step === 4 && MELODY[bar] && Math.floor(beat / 64) % 2 === 1) pluck(NOTE(MELODY[bar]), at + 0.02, 0.38);
    nextBeat += EIGHTH;
    beat++;
  }
}

// ---------- Ambience ----------

export function setAmbience(a: Ambience): void {
  if (a === ambience) return;
  ambience = a;
  if (!ctx) return;
  for (const n of ambNodes) {
    try {
      n.stop();
    } catch {
      // Already stopped.
    }
  }
  ambNodes = [];

  if (a === 'none') return;
  // Wind in the trees: low, slowly swelling.
  loopNoise('lowpass', a === 'camp' ? 500 : 650, 0.7, 0.05, true);
  if (a === 'creek') loopNoise('bandpass', 1500, 0.5, 0.06, false);
  if (a === 'creek' || a === 'marsh') loopNoise('lowpass', 300, 0.7, 0.05, false);
}

function loopNoise(type: BiquadFilterType, freq: number, q: number, gain: number, swell: boolean): GainNode {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ambBus);
  src.start(0, Math.random() * 2);
  ambNodes.push(src);
  if (swell) {
    // Gusts: a slow wobble on the volume.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.04;
    const depth = c.createGain();
    depth.gain.value = gain * 0.7;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    ambNodes.push(lfo);
  }
  return g;
}

/** 0 by day, 1 at night: birds give way to crickets. */
export function setNight(n: number): void {
  night = n;
}

function birdCall(at: number): void {
  // A few kinds of songbird: a rising whistle, a quick trill, a two-note "chick-a-dee".
  const kind = Math.floor(Math.random() * 3);
  const pan = ctx!.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  const g = ctx!.createGain();
  g.gain.value = 0.25 + Math.random() * 0.2;
  g.connect(pan).connect(ambBus);
  const base = 2600 + Math.random() * 1600;
  if (kind === 0) {
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone({ at: at + i * 0.16, freq: base, to: base * 1.4, dur: 0.12, gain: 0.18, out: g });
  } else if (kind === 1) {
    for (let i = 0; i < 6; i++) tone({ at: at + i * 0.05, freq: base * 1.2, to: base * 0.9, dur: 0.045, gain: 0.12, out: g });
  } else {
    tone({ at, freq: base * 1.3, dur: 0.18, gain: 0.16, out: g });
    tone({ at: at + 0.22, freq: base, dur: 0.12, gain: 0.12, out: g });
    tone({ at: at + 0.36, freq: base, dur: 0.12, gain: 0.12, out: g });
  }
}

function tickAmbience(): void {
  if (!ctx || ambience === 'none') return;
  const now = ctx.currentTime;
  if (now > nextBird && night < 0.5) {
    birdCall(now + 0.05);
    nextBird = now + 2.5 + Math.random() * 6;
  }
  if (now > nextCricket && night > 0.3) {
    for (let i = 0; i < 3; i++) tone({ at: now + i * 0.07, freq: 4200, dur: 0.04, gain: 0.05 * night, type: 'triangle', out: ambBus });
    nextCricket = now + 0.6 + Math.random() * 0.8;
  }
  if (ambience === 'camp' && now > nextCrackle) {
    // The campfire: little pops and a soft hiss.
    noiseBurst({ dur: 0.03 + Math.random() * 0.05, type: 'highpass', freq: 2500, gain: 0.08 + Math.random() * 0.12, out: ambBus });
    nextCrackle = now + 0.08 + Math.random() * 0.5;
  }
}

function tick(): void {
  scheduleMusic();
  tickAmbience();
}

// ---------- Effects ----------

function vibrate(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported (iPhone Safari): sound only.
  }
}

export const sfx = {
  /** A soft footstep on dry grass and leaves. */
  step(sneak = false): void {
    noiseBurst({ dur: 0.07, type: 'bandpass', freq: 1800 + Math.random() * 900, q: 0.8, gain: sneak ? 0.05 : 0.12 });
  },
  /** The whoosh of the line as it unrolls. */
  cast(): void {
    noiseBurst({ dur: 0.45, type: 'bandpass', freq: 600, sweepTo: 2600, q: 1.5, gain: 0.25, attack: 0.15 });
  },
  /** False-casting while you hold: a soft swish each stroke. */
  swish(): void {
    noiseBurst({ dur: 0.22, type: 'bandpass', freq: 900, sweepTo: 1800, q: 1.2, gain: 0.08, attack: 0.08 });
  },
  /** A fly settling on the water. */
  plop(): void {
    tone({ freq: 900, to: 300, dur: 0.12, gain: 0.25 });
    noiseBurst({ dur: 0.12, type: 'highpass', freq: 3000, gain: 0.06 });
  },
  /** A trout rising to take the fly. */
  bite(): void {
    tone({ freq: 500, to: 180, dur: 0.18, gain: 0.4 });
    noiseBurst({ dur: 0.25, type: 'bandpass', freq: 1600, q: 0.7, gain: 0.3 });
    vibrate([40, 30, 40]);
  },
  /** Setting the hook: a sharp tug. */
  hookSet(): void {
    noiseBurst({ dur: 0.08, type: 'bandpass', freq: 1200, q: 2, gain: 0.3 });
    tone({ freq: 220, to: 330, dur: 0.15, gain: 0.25, type: 'triangle' });
    vibrate(60);
  },
  /** One click of the reel's ratchet. */
  reelClick(): void {
    noiseBurst({ dur: 0.018, type: 'highpass', freq: 4000, gain: 0.12 });
  },
  /** The drag singing as a fish runs. */
  drag(): void {
    tone({ freq: 1900 + Math.random() * 200, dur: 0.06, gain: 0.05, type: 'sawtooth' });
  },
  /** A fish jumping or thrashing at the surface. */
  splash(big = false): void {
    noiseBurst({ dur: big ? 0.6 : 0.35, type: 'bandpass', freq: 1400, q: 0.6, gain: big ? 0.45 : 0.3, attack: 0.01 });
    noiseBurst({ dur: 0.2, type: 'lowpass', freq: 400, gain: big ? 0.3 : 0.15 });
  },
  /** The tippet breaking. */
  snap(): void {
    tone({ freq: 1400, to: 300, dur: 0.18, gain: 0.25, type: 'triangle' });
    vibrate(120);
  },
  /** A rifle or shotgun shot, with the echo rolling back off the hills. */
  gunshot(shotgun = false): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    noiseBurst({ at: t, dur: shotgun ? 0.4 : 0.3, type: 'lowpass', freq: shotgun ? 2500 : 3500, gain: 1, attack: 0.002 });
    tone({ at: t, freq: 110, to: 40, dur: 0.35, gain: 0.8 });
    for (let i = 1; i <= 3; i++) noiseBurst({ at: t + 0.35 * i + 0.2, dur: 0.5, type: 'lowpass', freq: 900 / i, gain: 0.25 / i, attack: 0.03 });
    vibrate(80);
  },
  /** A bowstring. */
  bow(): void {
    tone({ freq: 160, to: 110, dur: 0.25, gain: 0.4, type: 'triangle' });
    noiseBurst({ dur: 0.1, type: 'bandpass', freq: 1200, gain: 0.15 });
    vibrate(40);
  },
  /** The bullet or arrow striking. */
  hit(): void {
    tone({ freq: 120, to: 60, dur: 0.15, gain: 0.5 });
  },
  /** An animal crashing off through the brush. */
  flee(): void {
    for (let i = 0; i < 4; i++) noiseBurst({ at: (ctx?.currentTime ?? 0) + i * 0.12, dur: 0.08, type: 'bandpass', freq: 900, gain: 0.12 });
  },
  /** Wings beating as birds flush. */
  flush(): void {
    if (!ctx) return;
    for (let i = 0; i < 7; i++) noiseBurst({ at: ctx.currentTime + i * 0.05, dur: 0.05, type: 'bandpass', freq: 700 + i * 60, q: 1, gain: 0.12 });
  },
  /** A coin landing in the till. */
  coin(at = 0): void {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    tone({ at: t, freq: 1568, dur: 0.12, gain: 0.18, type: 'square' });
    tone({ at: t + 0.06, freq: 2093, dur: 0.22, gain: 0.15, type: 'square' });
  },
  /** Something new for the journal: a bright little rising run. */
  fanfare(): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    [67, 71, 74, 79].forEach((n, i) => pluck(NOTE(n), t + i * 0.09, 0.6, sfxBus));
  },
  /** A soft tap for buttons. */
  ui(): void {
    tone({ freq: 700, to: 500, dur: 0.05, gain: 0.08, type: 'triangle' });
  },
  /** A short down-turn for a missed chance. */
  aww(): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    pluck(NOTE(62), t, 0.4, sfxBus);
    pluck(NOTE(58), t + 0.15, 0.4, sfxBus);
  },
};

/** Stop the timer (only used by tests). */
export function shutdownAudio(): void {
  if (ticker) window.clearInterval(ticker);
}
