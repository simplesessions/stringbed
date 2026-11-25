// Small interface sounds, synthesized with Web Audio (no library, no audio files): the knock of a
// hard thing on wood or felt. Each is a few sine partials that ring down on their own, plus a
// breath of filtered noise for the contact. Pitch never slides or jumps; that is what sounds like
// an arcade game. Off by default and remembered.

const KEY = 'stringbed.sound';

interface Knock {
  /** Peak level, 0–1. */
  level: number;
  /** [frequency in Hz, share of the level, decay time constant in seconds] */
  partials: ReadonlyArray<readonly [number, number, number]>;
  /** The moment of contact: band-passed noise. */
  contact: { hz: number; share: number; decay: number };
}

const SOUNDS = {
  /** A fingertip on felt, as the line-up moves to another racquet. */
  hover: {
    level: 0.06,
    partials: [[392, 0.7, 0.014], [1035, 0.15, 0.006]],
    contact: { hz: 1500, share: 0.25, decay: 0.004 },
  },
  /** A small wooden tick: choosing a filter or a generation. */
  pick: {
    level: 0.1,
    partials: [[523, 0.65, 0.022], [1390, 0.14, 0.009]],
    contact: { hz: 2100, share: 0.22, decay: 0.004 },
  },
  /** A racquet set down on a wooden counter. */
  open: {
    level: 0.16,
    partials: [[220, 0.62, 0.07], [446, 0.2, 0.04], [905, 0.07, 0.016]],
    contact: { hz: 1100, share: 0.18, decay: 0.008 },
  },
  /** The same counter, touched more lightly and lower. */
  back: {
    level: 0.12,
    partials: [[185, 0.62, 0.05], [375, 0.2, 0.03], [760, 0.06, 0.012]],
    contact: { hz: 900, share: 0.15, decay: 0.007 },
  },
} satisfies Record<string, Knock>;
export type SoundName = keyof typeof SOUNDS;

const ATTACK = 0.002; // long enough not to click
const SILENT = 6; // time constants until a partial is inaudible (-52 dB)

let enabled = false;
let lastHover = 0;
let out: { ctx: AudioContext; bus: AudioNode; noise: AudioBuffer } | null = null;

function openOutput(): NonNullable<typeof out> {
  const ctx = new AudioContext();
  // Everything passes a gentle low-pass, so nothing is brittle on small speakers.
  const bus = ctx.createBiquadFilter();
  bus.type = 'lowpass';
  bus.frequency.value = 4200;
  bus.Q.value = 0.5;
  bus.connect(ctx.destination);
  const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.1), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return { ctx, bus, noise };
}

function strike({ ctx, bus, noise }: NonNullable<typeof out>, k: Knock): void {
  const t = ctx.currentTime;
  const tune = 1 + (Math.random() - 0.5) * 0.02; // no two touches are quite identical
  const voice = (source: AudioScheduledSourceNode, from: AudioNode, level: number, decay: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + ATTACK);
    g.gain.setTargetAtTime(0, t + ATTACK, decay);
    from.connect(g).connect(bus);
    source.start(t);
    source.stop(t + ATTACK + decay * SILENT);
    source.onended = () => g.disconnect();
  };
  for (const [hz, share, decay] of k.partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz * tune;
    voice(osc, osc, k.level * share, decay);
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = k.contact.hz;
  band.Q.value = 0.8;
  src.connect(band);
  voice(src, band, k.level * k.contact.share, k.contact.decay);
}

export const soundOn = () => enabled;

/** Play a sound. All but `hover` must be called from a click, which is what lets audio start. */
export function play(name: SoundName): void {
  if (!enabled) return;
  if (name === 'hover') {
    // Hovering may not start audio: a sound queued before the first click would fire with it.
    if (out?.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - lastHover < 90) return; // sweeping down a list should patter softly
    lastHover = now;
  }
  try {
    const o = (out ??= openOutput());
    if (o.ctx.state === 'running') strike(o, SOUNDS[name]);
    else void o.ctx.resume().then(() => strike(o, SOUNDS[name]), () => {});
  } catch {
    enabled = false; // no Web Audio here
  }
}

export function setSound(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: lasts for this visit */
  }
}

export const storedSound = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};
