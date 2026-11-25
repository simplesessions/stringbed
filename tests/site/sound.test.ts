import { test, expect } from 'bun:test';
import { GAP_MS, SOUNDS, sounds, type Knock, type Output, type SoundName, type Voice } from '../../site/src/sound';

/** The module on a hand-wound clock, with an output that keeps what it is asked to sound. */
function rig({ on = true, running = true, gesture = true } = {}) {
  const r = { now: 1000, running, gesture, opened: 0, closed: 0, played: [] as (readonly Voice[])[], cut: [] as number[], resumed: () => {} };
  const s = sounds({
    now: () => r.now,
    gesture: () => r.gesture,
    open: (): Output => {
      r.opened++;
      return {
        running: () => r.running,
        resume: () => new Promise((done) => { r.resumed = () => { r.running = true; done(); }; }),
        sound: (voices) => {
          const i = r.played.push(voices) - 1;
          return () => { r.cut.push(i); };
        },
        close: () => { r.closed++; },
      };
    },
  });
  if (on) s.setSound(true);
  return Object.assign(r, s);
}

const NEW = ['ratchet', 'peel', 'press', 'wrap', 'stamp'] as const satisfies readonly SoundName[];
const ALL = Object.keys(SOUNDS) as SoundName[];
const knock = (name: SoundName): Knock => SOUNDS[name];
const total = (voices: readonly Voice[]) => voices.reduce((sum, v) => sum + v.level, 0);
/** When the last of it falls silent, in seconds. */
const ends = (voices: readonly Voice[]) => Math.max(...voices.map((v) => v.at + (v.attack ?? 0.002) + v.decay * 6));
const played = (name: SoundName) => {
  const r = rig();
  r.play(name);
  expect(r.played.length).toBe(1);
  return r.played[0];
};
const plucked = (hz: number, muted = false) => {
  const r = rig();
  r.pluck(hz, { muted });
  expect(r.played.length).toBe(1);
  return r.played[0];
};

test('no sound is over 0.16', () => {
  for (const name of ALL) expect(knock(name).level).toBeLessThanOrEqual(0.16);
});

test('a new knock is no louder than its level, all voices together', () => {
  for (const name of NEW) {
    const first = played(name).filter((v) => v.at === 0);
    expect(total(first)).toBeGreaterThan(0);
    expect(total(first)).toBeLessThanOrEqual(knock(name).level + 1e-9);
  }
});

test('a run never adds up past 0.16, ring of the earlier knocks included', () => {
  for (const name of ['wrap'] as const) {
    const voices = played(name);
    for (const t of new Set(voices.map((v) => v.at))) {
      const sum = voices.filter((v) => v.at <= t).reduce((n, v) => n + v.level * Math.exp(-(t - v.at) / v.decay), 0);
      expect(sum).toBeLessThanOrEqual(0.16);
    }
  }
});

test('wrap is a run of one knock and is over within 400 ms', () => {
  expect(ALL.filter((name) => knock(name).run)).toEqual(['wrap']);
  for (const name of ['wrap'] as const) {
    const voices = played(name);
    const starts = [...new Set(voices.map((v) => v.at))];
    expect(starts).toEqual([...knock(name).run!]);
    expect(starts.length).toBeGreaterThan(1);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts[0]).toBe(0);
    expect(ends(voices)).toBeLessThanOrEqual(0.4);
    const per = voices.length / starts.length; // the same knock every time
    expect(per).toBe(knock(name).partials.length + 1);
  }
});

test('lead tape is stroked, not struck, and the peel is over before the press', () => {
  expect(SOUNDS.peel.contact.attack).toBeGreaterThan(0.05);
  expect(SOUNDS.peel.partials).toEqual([]);
  expect(ends(played('peel'))).toBeLessThan(0.3); // build-lead.ts PRESS_AFTER
  expect(SOUNDS.press.contact.attack).toBeGreaterThan(0.01);
  expect(SOUNDS.press.level).toBeLessThanOrEqual(0.05);
});

test('the single sounds are one knock', () => {
  for (const name of ['ratchet', 'peel', 'press', 'stamp'] as const) {
    const voices = played(name);
    expect(voices.every((v) => v.at === 0)).toBe(true);
    expect(voices.filter((v) => v.noise).length).toBe(1);
  }
});

test('a pluck is 1, 2 and 3 times the pitch it is given, ringing 0.11, 0.05 and 0.022 s', () => {
  const v = plucked(571);
  expect(v.map((x) => x.hz)).toEqual([571, 1142, 1713]); // never detuned
  expect(v.map((x) => x.decay)).toEqual([0.11, 0.05, 0.022]);
  expect(v.every((x) => x.at === 0 && !x.noise && x.attack === 0.005)).toBe(true);
});

test('a dampener cuts the ring and nothing else', () => {
  const open = plucked(629);
  const muted = plucked(629, true);
  expect(muted.map((x) => x.decay)).toEqual([0.04, 0.02, 0.01]);
  expect(muted.map((x) => [x.hz, x.level])).toEqual(open.map((x) => [x.hz, x.level]));
});

test('pluck pitch: 200 to 1200 Hz pass unchanged, the rest clamp', () => {
  for (const hz of [200, 201, 571, 1199, 1200]) expect(plucked(hz)[0].hz).toBe(hz);
  for (const [hz, to] of [[199, 200], [0, 200], [-50, 200], [1201, 1200], [9000, 1200], [Infinity, 1200]]) {
    expect(plucked(hz).map((v) => v.hz)).toEqual([to, to * 2, to * 3]);
  }
});

test('a pitch that is not a number is silent, and sound stays on', () => {
  const r = rig();
  r.pluck(NaN, { muted: false });
  expect(r.played).toEqual([]);
  expect(r.soundOn()).toBe(true);
});

test('a pluck totals at most 0.16 whatever its pitch', () => {
  for (const hz of [0, 200, 571, 629, 1200, 9000]) {
    for (const muted of [false, true]) {
      expect(total(plucked(hz, muted))).toBeLessThanOrEqual(0.16);
      expect(total(plucked(hz, muted))).toBeGreaterThan(0.05);
    }
  }
});

test('plucking again stops the ring of the last pluck', () => {
  const r = rig();
  r.pluck(500, { muted: false });
  expect(r.cut).toEqual([]);
  r.now += 60;
  r.pluck(520, { muted: false });
  expect(r.cut).toEqual([0]);
  r.now += 60;
  r.play('ratchet'); // not a string
  expect(r.cut).toEqual([0]);
});

test('ratchet and pluck share one slot per 60 ms', () => {
  expect(GAP_MS.bed).toBe(60);
  const r = rig();
  r.play('ratchet');
  r.now += 59;
  r.play('ratchet');
  r.pluck(571, { muted: false });
  expect(r.played.length).toBe(1);
  r.now += 1;
  r.pluck(571, { muted: false });
  expect(r.played.length).toBe(2);
  r.now += 59;
  r.play('ratchet');
  expect(r.played.length).toBe(2);
  r.now += 1;
  r.play('ratchet');
  expect(r.played.length).toBe(3);
});

test('30 seconds of dragging at 120 events a second is at most one sound per 60 ms', () => {
  const r = rig();
  for (let i = 0; i < 30 * 120; i++) {
    r.play('ratchet');
    r.pluck(400 + (i % 300), { muted: false });
    r.now += 1000 / 120;
  }
  expect(r.played.length).toBeLessThanOrEqual(501);
  expect(r.played.length).toBeGreaterThan(400);
});

test('the other sounds do not wait for that slot', () => {
  const r = rig();
  r.play('ratchet');
  for (const name of ['peel', 'press', 'wrap', 'stamp'] as const) r.play(name);
  expect(r.played.length).toBe(5);
});

test('hover keeps its own slot of 90 ms', () => {
  const r = rig();
  r.play('pick'); // audio is running
  r.play('hover');
  r.now += 89;
  r.play('hover');
  expect(r.played.length).toBe(2);
  r.now += 1;
  r.play('hover');
  expect(r.played.length).toBe(3);
});

test('off until switched on: nothing plays and no audio is opened', () => {
  const r = rig({ on: false });
  expect(r.soundOn()).toBe(false);
  for (const name of ALL) r.play(name);
  r.pluck(571, { muted: false });
  expect(r.played).toEqual([]);
  expect(r.opened).toBe(0);
});

test('switching off stops what is ringing and refuses what follows', () => {
  const r = rig();
  r.pluck(571, { muted: false });
  r.setSound(false);
  expect(r.closed).toBe(1);
  r.now += 1000;
  for (const name of ALL) r.play(name);
  r.pluck(571, { muted: false });
  expect(r.played.length).toBe(1);
  expect(r.opened).toBe(1);
  r.setSound(true);
  r.play('stamp');
  expect(r.opened).toBe(2);
  expect(r.played.length).toBe(2);
});

test('without a gesture nothing starts audio, and nothing waits to fire with the first click', async () => {
  const r = rig({ running: false, gesture: false });
  for (const name of ALL) r.play(name);
  r.pluck(571, { muted: false });
  expect(r.opened).toBe(0);
  r.gesture = true;
  r.play('pick');
  r.resumed();
  await Promise.resolve();
  expect(r.played.length).toBe(1);
});

test('a sound refused for want of a gesture does not use up the slot', () => {
  const r = rig({ gesture: false });
  r.pluck(571, { muted: false });
  r.gesture = true;
  r.pluck(571, { muted: false });
  expect(r.played.length).toBe(1);
});

test('while audio wakes, only the latest sound waits', async () => {
  const r = rig({ running: false });
  for (let i = 0; i < 10; i++) {
    r.play('ratchet');
    r.now += 60;
  }
  r.pluck(571, { muted: false });
  expect(r.played).toEqual([]);
  r.resumed();
  await Promise.resolve();
  expect(r.played.map((v) => v[0].hz)).toEqual([571]);
});

test('switched off while audio wakes: it stays silent', async () => {
  const r = rig({ running: false });
  r.play('stamp');
  r.setSound(false);
  r.resumed();
  await Promise.resolve();
  expect(r.played).toEqual([]);
});

test('no Web Audio: sound turns itself off', () => {
  const s = sounds({ now: () => 0, gesture: () => true, open: () => { throw new Error('none'); } });
  s.setSound(true);
  s.play('stamp');
  expect(s.soundOn()).toBe(false);
});

test('the page\'s own sounds are off to begin with', async () => {
  const { soundOn } = await import('../../site/src/sound');
  expect(soundOn()).toBe(false);
});
