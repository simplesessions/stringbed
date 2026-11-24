// Small interface sounds, synthesized on the fly by ZzFX (MIT, ~1 kB of code, no audio files).
// Off by default and remembered. ZzFX opens an AudioContext when it loads, so it is imported
// only after the visitor turns sound on, which is also a user gesture.
type Zzfx = (typeof import('zzfx'))['zzfx'];

const KEY = 'stringbed.sound';
let zzfx: Zzfx | null = null;
let enabled = false;
let lastHover = 0;

// zzfx(volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
//      deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
//      sustainVolume, decay, tremolo, filter)
const SOUNDS = {
  /** A felt-ball tick when a racquet is touched; pitch climbs along the row. */
  hover: (i: number) => [0.18, 0.08, 520 + (i % 8) * 38, 0.002, 0.004, 0.05, 0, 1.2, , , , , , , , , , 0.5, 0.01] as const,
  /** A string pluck and a soft thud as a racquet opens. */
  open: () => [0.5, 0.05, 196, 0.004, 0.05, 0.28, 0, 1.4, 6, , 90, 0.04, , , , , , 0.7, 0.06] as const,
  /** The same gesture reversed. */
  back: () => [0.4, 0.05, 330, 0.004, 0.04, 0.22, 0, 1.4, -7, , -70, 0.04, , , , , , 0.6, 0.05] as const,
  /** Choosing a filter. */
  pick: () => [0.3, 0.05, 660, 0.002, 0.01, 0.09, 1, 1.5, , , 140, 0.03, , , , , , 0.6, 0.02] as const,
  /** A fan of racquets opening: a soft, airy swish. */
  swish: () => [0.12, 0.3, 90, 0.04, 0.06, 0.2, 4, 1, 3, , , , , 2.2, , , , 0.5, 0.1, , 700] as const,
  /** Racquets landing on the rail. */
  land: () => [0.16, 0.2, 140, 0.002, 0.01, 0.1, 4, 1, , , , , , 0.6, , , , 0.4, 0.03] as const,
};
export type SoundName = keyof typeof SOUNDS;

export const soundOn = () => enabled;

export function play(name: SoundName, i = 0): void {
  if (!enabled || !zzfx) return;
  if (name === 'hover') {
    const now = performance.now();
    if (now - lastHover < 60) return; // sweeping across a row should patter, not machine-gun
    lastHover = now;
  }
  const params = (SOUNDS[name] as (i: number) => readonly (number | undefined)[])(i);
  void zzfx(...(params as number[]));
}

export async function setSound(on: boolean): Promise<void> {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: lasts for this visit */
  }
  if (on && !zzfx) {
    try {
      zzfx = (await import('zzfx')).zzfx;
    } catch {
      enabled = false;
      return;
    }
  }
  if (on) play('pick');
}

export const storedSound = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};
