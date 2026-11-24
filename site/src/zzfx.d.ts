declare module 'zzfx' {
  /** Play a sound from ZzFX's positional parameters (see sound.ts). */
  export function zzfx(...parameters: Array<number | undefined>): AudioBufferSourceNode;
}
