// Small interface sounds, synthesized with Web Audio (no library, no audio files): the knock of a
// hard thing on wood or felt. Each is a few sine partials that ring down on their own, plus a
// breath of filtered noise for the contact. Pitch never slides or jumps; that is what sounds like
// an arcade game. Off by default and remembered. The build page's strings are the one exception to
// the knock: a pluck, at the pitch the bed works out to.

const KEY = 'stringbed.sound';

export interface Knock {
  /** Peak level, 0–1. */
  level: number;
  /** [frequency in Hz, share of the level, decay time constant in seconds] */
  partials: ReadonlyArray<readonly [number, number, number]>;
  /** The moment of contact: band-passed noise. With an `attack` (seconds) it is drawn rather than struck. */
  contact: { hz: number; share: number; decay: number; attack?: number };
  /** Strike it at each of these times (seconds) instead of once. */
  run?: readonly number[];
}

export const SOUNDS = {
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
  /** A string opened: a plastic reel set on the same counter. Hollow, light, and gone sooner than a racquet. */
  spool: {
    level: 0.14,
    partials: [[338, 0.5, 0.034], [812, 0.26, 0.018], [1630, 0.1, 0.008]],
    contact: { hz: 1900, share: 0.24, decay: 0.005 },
  },
  /** The same counter, touched more lightly and lower. */
  back: {
    level: 0.12,
    partials: [[185, 0.62, 0.05], [375, 0.2, 0.03], [760, 0.06, 0.012]],
    contact: { hz: 900, share: 0.15, decay: 0.007 },
  },
  /** One tooth of the stringing machine's tension head. */
  ratchet: {
    level: 0.07,
    partials: [[1180, 0.45, 0.008], [2360, 0.12, 0.004]],
    contact: { hz: 2600, share: 0.25, decay: 0.003 },
  },
  /** String drawn through the grommets: the mains, a breath, the crosses. Two long soft strokes; a run of
   * quick ticks here (over 20 a second) fuses into a buzzer. */
  weave: {
    level: 0.045,
    partials: [],
    contact: { hz: 780, share: 1, decay: 0.026, attack: 0.055 },
    run: [0, 0.18],
  },
  /** Lead tape coming off its backing: one papery stroke. Ticks here, then the press, are a punch clock. */
  peel: {
    level: 0.032,
    partials: [],
    contact: { hz: 1250, share: 1, decay: 0.028, attack: 0.085 },
  },
  /** A thumb smoothing the tape down: felt, hardly a knock. */
  press: {
    level: 0.05,
    partials: [[150, 0.34, 0.018]],
    contact: { hz: 480, share: 0.5, decay: 0.022, attack: 0.014 },
  },
  /** An overgrip going round the handle, turn by turn, under the hand. */
  wrap: {
    level: 0.09,
    partials: [[178, 0.45, 0.018], [350, 0.15, 0.01]],
    contact: { hz: 700, share: 0.4, decay: 0.016 },
    run: [0, 0.092, 0.18, 0.272],
  },
  /** A rubber dampener pushed between two strings. */
  thump: {
    level: 0.14,
    partials: [[142, 0.65, 0.045], [286, 0.2, 0.02]],
    contact: { hz: 440, share: 0.12, decay: 0.008 },
  },
  /** A wooden stamp on paper: the link copied. */
  stamp: {
    level: 0.15,
    partials: [[262, 0.55, 0.04], [612, 0.2, 0.02], [1240, 0.07, 0.01]],
    contact: { hz: 1300, share: 0.18, decay: 0.006 },
  },
} satisfies Record<string, Knock>;
export type SoundName = keyof typeof SOUNDS;

/** A string of the bed, under a fingertip: [multiple of its pitch, share of the level, ring in seconds, ring
 * with a dampener]. Mostly its own note and soon gone: a long clear ring is a game-show tone. */
const PLUCK = {
  level: 0.1,
  attack: 0.005,
  partials: [[1, 0.72, 0.11, 0.04], [2, 0.14, 0.05, 0.02], [3, 0.04, 0.022, 0.01]],
  low: 200,
  high: 1200,
} as const;

/** Milliseconds before the next sound of a kind: sweeping a list or a tension slider should patter softly. */
export const GAP_MS = { hover: 90, bed: 60 };
type Kind = keyof typeof GAP_MS;

const ATTACK = 0.002; // long enough not to click
const SILENT = 6; // time constants until a partial is inaudible (-52 dB)

/** One sine, or one band of noise, that rises at `at` (seconds from now) and rings down. */
export interface Voice {
  hz: number;
  level: number;
  decay: number;
  at: number;
  /** Seconds to its peak, if not the shortest that does not click. */
  attack?: number;
  noise?: boolean;
}

/** Where voices go. Web Audio on the page. */
export interface Output {
  running(): boolean;
  resume(): Promise<void>;
  /** Sound these together; call the result to damp them. */
  sound(voices: readonly Voice[]): () => void;
  close(): void;
}

function struck(k: Knock): Voice[] {
  return (k.run ?? [0]).flatMap((at) => {
    const tune = 1 + (Math.random() - 0.5) * 0.02; // no two touches are quite identical
    return [
      ...k.partials.map(([hz, share, decay]) => ({ hz: hz * tune, level: k.level * share, decay, at })),
      { hz: k.contact.hz, level: k.level * k.contact.share, decay: k.contact.decay, at, attack: k.contact.attack, noise: true },
    ];
  });
}

function plucked(hz: number, muted: boolean): Voice[] {
  const pitch = Math.min(PLUCK.high, Math.max(PLUCK.low, hz));
  return PLUCK.partials.map(([n, share, ring, damped]) => ({ hz: pitch * n, level: PLUCK.level * share, decay: muted ? damped : ring, at: 0, attack: PLUCK.attack }));
}

function webAudio(): Output {
  const ctx = new AudioContext();
  // Everything passes a gentle low-pass, so nothing is brittle on small speakers.
  const bus = ctx.createBiquadFilter();
  bus.type = 'lowpass';
  bus.frequency.value = 4200;
  bus.Q.value = 0.5;
  bus.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const voice = ({ hz, level, decay, at, attack = ATTACK, noise: rough }: Voice, now: number): GainNode => {
    const t = now + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setTargetAtTime(0, t + attack, decay);
    g.connect(bus);
    let source: AudioScheduledSourceNode;
    if (rough) {
      const src = (source = ctx.createBufferSource());
      src.buffer = noise;
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = hz;
      band.Q.value = 0.8;
      src.connect(band).connect(g);
      src.start(t, Math.random() * noise.duration); // or every knock of a run is the same grain
    } else {
      const osc = (source = ctx.createOscillator());
      osc.frequency.value = hz;
      osc.connect(g);
      osc.start(t);
    }
    source.stop(t + attack + decay * SILENT);
    source.onended = () => g.disconnect();
    return g;
  };
  return {
    running: () => ctx.state === 'running',
    resume: () => ctx.resume(),
    sound(voices) {
      const now = ctx.currentTime;
      const gains = voices.map((v) => voice(v, now));
      return () => gains.forEach((g) => g.gain.setTargetAtTime(0, ctx.currentTime, 0.008));
    },
    close: () => void ctx.close().catch(() => {}),
  };
}

/** The sounds over a clock, a way to tell a gesture and an output, so tests can stand in for all three. */
export function sounds(host: { now(): number; gesture(): boolean; open(): Output }) {
  let enabled = false;
  let out: Output | null = null;
  let waiting: ((o: Output) => void) | null = null;
  let damp: (() => void) | null = null; // the last pluck's ring
  const last = { hover: -Infinity, bed: -Infinity };

  function start(make: (o: Output) => void, kind?: Kind): void {
    if (!enabled) return;
    // Only a gesture may start audio, and hovering is not one: a sound queued before the first
    // click would fire with it.
    if (!out?.running() && (kind === 'hover' || !host.gesture())) return;
    if (kind) {
      const now = host.now();
      if (now - last[kind] < GAP_MS[kind]) return;
      last[kind] = now;
    }
    try {
      const o = (out ??= host.open());
      if (o.running()) return make(o);
      waiting = make; // one at a time, or a drag's worth would go off together
      void o.resume().then(() => {
        if (o !== out) return; // switched off meanwhile
        const next = waiting;
        waiting = null;
        next?.(o);
      }).catch(() => {});
    } catch {
      enabled = false; // no Web Audio here
    }
  }

  return {
    soundOn: () => enabled,
    /** Play a sound. All but `hover` must come from a gesture, which is what lets audio start. */
    play(name: SoundName): void {
      start((o) => void o.sound(struck(SOUNDS[name])), name === 'hover' ? 'hover' : name === 'ratchet' ? 'bed' : undefined);
    },
    /** A string of the bed, at its own pitch. `muted`: a dampener is on it. */
    pluck(hz: number, { muted }: { muted: boolean }): void {
      if (Number.isNaN(hz)) return; // Web Audio would throw
      start((o) => {
        damp?.(); // the same bed cannot ring twice at once
        damp = o.sound(plucked(hz, muted));
      }, 'bed');
    },
    setSound(on: boolean): void {
      enabled = on;
      if (on) return;
      out?.close(); // a ring or a run stops with the switch
      out = waiting = damp = null;
    },
  };
}

const page = sounds({
  now: () => performance.now(),
  gesture: () => navigator.userActivation?.isActive ?? true, // a browser too old to say
  open: webAudio,
});
export const { play, pluck, soundOn } = page;

export function setSound(on: boolean): void {
  page.setSound(on);
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
