// When things happen on the build page: the address, the dressing, the sounds and the words all wait
// for something. A clock is passed in, so tests move it by hand and a page that is left stops its own.

export interface Clock {
  now(): number;
  /** Run this later; call the result to call it off. */
  later(run: () => void, ms: number): () => void;
  /** Run this before the next frame. */
  frame(run: () => void): () => void;
}

export const browserClock: Clock = {
  now: () => performance.now(),
  later(run, ms) {
    const t = setTimeout(run, Math.ceil(ms) + 1); // timers may fire a hair early
    return () => clearTimeout(t);
  },
  frame(run) {
    const t = requestAnimationFrame(run);
    return () => cancelAnimationFrame(t);
  },
};

/** The same clock until the signal aborts. Then what was waiting is called off and nothing more is taken. */
export function until(signal: AbortSignal, clock: Clock): Clock {
  const waiting = new Set<() => void>();
  signal.addEventListener('abort', () => {
    for (const off of waiting) off();
    waiting.clear();
  });
  const take = (ask: (run: () => void) => () => void, run: () => void): (() => void) => {
    if (signal.aborted) return () => {};
    const off = ask(() => {
      waiting.delete(off);
      run();
    });
    waiting.add(off);
    return () => {
      waiting.delete(off);
      off();
    };
  };
  return {
    now: clock.now,
    later: (run, ms) => take((r) => clock.later(r, ms), run),
    frame: (run) => take(clock.frame, run),
  };
}

export interface AddressWriter {
  touch(): void;
  /** Write what is pending now: the page is about to be left. */
  flush(): void;
  cancel(): void;
}

/** Writes at once, then no more than once every `gapMs`, and once more at rest. Safari refuses a page that writes 100 times in 30 s. */
export function addressWriter(write: () => void, gapMs: number, clock: Clock): AddressWriter {
  let last = -Infinity;
  let off: (() => void) | null = null;
  const go = () => {
    off?.();
    off = null;
    last = clock.now();
    try {
      write();
    } catch {
      off = clock.later(go, gapMs * 10); // the browser has had enough: the page still works, and the address catches up
    }
  };
  return {
    touch() {
      if (off) return;
      const wait = last + gapMs - clock.now();
      if (wait <= 0) go();
      else off = clock.later(go, wait);
    },
    flush() {
      if (off) go();
    },
    cancel() {
      off?.();
      off = null;
    },
  };
}

/** Dressing lays tape and strings again, so it happens at most once a frame, and less often when it is slow. The last call always lands. */
export function dresser(dress: () => void, clock: Clock): { soon(): void } {
  let off: (() => void) | null = null;
  let free = 0;
  const run = () => {
    off = null;
    const start = clock.now();
    if (start < free) {
      off = clock.frame(run);
      return;
    }
    dress();
    const end = clock.now();
    free = end + (end - start);
  };
  return {
    soon() {
      off ??= clock.frame(run);
    },
  };
}

/** Once things have been quiet for a while, once. */
export function lastWord(say: () => void, clock: Clock): { soon(ms: number): void; cancel(): void } {
  let off: (() => void) | null = null;
  const cancel = () => {
    off?.();
    off = null;
  };
  return {
    soon(ms) {
      cancel();
      off = clock.later(() => {
        off = null;
        say();
      }, ms);
    },
    cancel,
  };
}

/** The bed is plucked once things settle: muted after a restring, ringing after anything else. Only ever after something a visitor did. */
export function strummer(pluck: (muted: boolean) => void, restrungMs: number, clock: Clock): { restrung(): void; soon(ms: number): void; cancel(): void } {
  let muted = false;
  const word = lastWord(() => pluck(muted), clock);
  const soon = (ms: number, mute: boolean) => {
    muted = mute;
    word.soon(ms);
  };
  return { restrung: () => soon(restrungMs, true), soon: (ms) => soon(ms, false), cancel: word.cancel };
}
