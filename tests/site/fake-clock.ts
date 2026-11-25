import type { Clock } from '../../site/src/build-timing';

/** A clock a test moves by hand. Frames come every 16 ms. */
export function fakeClock() {
  let now = 0;
  let n = 0;
  const due: Array<{ at: number; n: number; run: () => void }> = [];
  const put = (run: () => void, ms: number) => {
    const t = { at: now + ms, n: n++, run };
    due.push(t);
    return () => void (due.includes(t) && due.splice(due.indexOf(t), 1));
  };
  const clock: Clock = { now: () => now, later: put, frame: (run) => put(run, 16 - (now % 16) || 16) };
  return Object.assign(clock, {
    waiting: () => due.length,
    /** Time passes inside whatever is running: work that takes a while. */
    spend: (ms: number) => void (now += ms),
    tick(ms: number) {
      const end = now + ms;
      for (;;) {
        const t = due.filter((x) => x.at <= end).sort((a, b) => a.at - b.at || a.n - b.n)[0];
        if (!t) break;
        due.splice(due.indexOf(t), 1);
        now = Math.max(now, t.at);
        t.run();
      }
      now = Math.max(now, end);
    },
  });
}
