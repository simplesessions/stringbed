import { test, expect } from 'bun:test';
import type { StringSpec } from '../../src/string-spec';
import { loadAllStrings } from '../../src/string-spec';
import { COLOURS, chooseString, emptyBuild, formatBuild, parseBuild, type Build, type StringChoice } from '../../site/src/build-state';

const real = loadAllStrings();
const stub = (id: string, colours: string[], gaugesMm: number[]) => ({ id, colours: colours.map((c) => ({ id: c, name: c, hex: '#808080' })), gaugesMm }) as unknown as StringSpec;
// The spec's example names a string that is not researched yet, so stand-ins carry it.
const strings = [stub('luxilon-alu-power', ['silver', 'black'], [1.2, 1.25, 1.3]), stub('babolat-touch-vs', ['natural', 'black'], [1.25, 1.3, 1.35])];

test('the empty build is an empty query and back', () => {
  expect(formatBuild(emptyBuild())).toBe('');
  expect(parseBuild('', strings)).toEqual({ build: emptyBuild(), dropped: [] });
  expect(parseBuild('', null)).toEqual({ build: emptyBuild(), dropped: [] });
});

test('a full build survives the address exactly', () => {
  const b: Build = {
    mains: { id: 'luxilon-alu-power', colour: 'silver', gaugeMm: 1.25 }, crosses: { id: 'babolat-touch-vs', colour: 'natural', gaugeMm: 1.3 },
    tensionLb: 52.5, crossTensionLb: 50,
    tape: [{ zone: 'h', at: 0, mirrored: true, lengthMm: 40, layers: 2 }, { zone: 'l', at: 150, mirrored: false, lengthMm: 60, layers: 1 }, { zone: 'r', at: 20, mirrored: true, lengthMm: 300, layers: 4 }, { zone: 'h', at: 359, mirrored: false, lengthMm: 10, layers: 3 }, { zone: 'r', at: 700, mirrored: false, lengthMm: 25, layers: 1 }],
    overgrip: 'white', dampener: 'red', yours: { g: 305, balanceMm: 320 },
  };
  const q = formatBuild(b);
  expect(q).toBe('v=1&s=luxilon-alu-power.silver.125~babolat-touch-vs.natural.130&t=52.5~50&l=h0m.40.2~l150.60.1~r20m.300.4~h359.10.3~r700.25.1&g=white&d=red&w=305&b=320');
  expect(parseBuild(q, strings)).toEqual({ build: b, dropped: [] });
  expect(parseBuild(q, null)).toEqual({ build: b, dropped: [] });
});

test('the spec’s own example parses', () => {
  const { build, dropped } = parseBuild('v=1&s=luxilon-alu-power.silver.125~babolat-touch-vs.natural.130&t=52~50&l=h90m.40.2~l150m.60.1&g=white&d=red&w=305&b=320', strings);
  expect(dropped).toEqual([]); expect(build.tape[0]).toEqual({ zone: 'h', at: 90, mirrored: true, lengthMm: 40, layers: 2 }); expect(build.crossTensionLb).toBe(50);
  expect(build.tape[1]).toEqual({ zone: 'l', at: 150, mirrored: true, lengthMm: 60, layers: 1 });
  expect(build.mains).toEqual({ id: 'luxilon-alu-power', colour: 'silver', gaugeMm: 1.25 }); expect(build.yours).toEqual({ g: 305, balanceMm: 320 });
});

test('out-of-range numbers are brought into range; unreadable parts are dropped and named; the rest is kept', () => {
  const { build, dropped } = parseBuild('t=99~10&l=h90.5.9~h90.40.2~x1.1.1~l5.1000.0~junk&g=mauve&d=blue&w=9000&b=abc', strings);
  expect([build.tensionLb, build.crossTensionLb]).toEqual([75, 30]);
  expect(build.tape).toEqual([{ zone: 'h', at: 90, mirrored: false, lengthMm: 10, layers: 4 }, { zone: 'h', at: 90, mirrored: false, lengthMm: 40, layers: 2 }, { zone: 'l', at: 5, mirrored: false, lengthMm: 300, layers: 1 }]);
  expect([build.overgrip, build.dampener, build.yours]).toEqual([null, 'blue', { g: 420 }]);
  expect(dropped).toEqual(['tape x1.1.1', 'tape junk', 'overgrip', 'balance']);
  expect(parseBuild('t=oops&w=305', null)).toMatchObject({ build: { tensionLb: 52, yours: { g: 305 } }, dropped: ['tension'] });
  expect(parseBuild('t=52.26', null).build.tensionLb).toBe(52.5);
  expect(parseBuild('l=' + 'h1.10.1~'.repeat(30), null)).toMatchObject({ build: { tape: { length: 24 } }, dropped: ['tape beyond 24'] });
  expect(parseBuild('l=h360.10.1', null).build.tape[0].at).toBe(0);
});

test('an unknown string, colour or gauge: stock / first colour / nearest gauge, the string named in dropped', () => {
  expect(parseBuild('s=gone-string.red.125', strings)).toEqual({ build: emptyBuild(), dropped: ['string gone-string.red.125'] });
  const mixed = parseBuild('s=luxilon-alu-power.silver.125~gone.x.1', strings);
  expect([mixed.build.mains?.id, mixed.build.crosses, mixed.dropped]).toEqual(['luxilon-alu-power', null, ['string gone.x.1']]);
  const { build, dropped } = parseBuild('s=luxilon-alu-power.mauve.128~babolat-touch-vs.natural.999', strings);
  expect(dropped).toEqual([]);
  expect(build.mains).toEqual({ id: 'luxilon-alu-power', colour: 'silver', gaugeMm: 1.3 });
  expect(build.crosses).toEqual({ id: 'babolat-touch-vs', colour: 'natural', gaugeMm: 1.35 });
  expect(parseBuild('s=Bad_Id.red.125', null).dropped).toHaveLength(1); // unchecked: ids are kebab-case only
  expect(parseBuild('s=a-b.red.125~c.blue.130', null).build.crosses).toEqual({ id: 'c', colour: 'blue', gaugeMm: 1.3 });
});

test('a cross whose main is unreadable goes too, and is named', () => {
  const { build, dropped } = parseBuild('s=gone.red.125~babolat-touch-vs.natural.130', strings);
  expect([build.mains, build.crosses]).toEqual([null, null]);
  expect(dropped).toEqual(['string gone.red.125', 'string babolat-touch-vs.natural.130']);
  expect(parseBuild('s=~a.b.100', null).dropped).toEqual(['string (empty)', 'string a.b.100']);
});

test('a string with no readable gauge is dropped the same way checked or not', () => {
  for (const s of [strings, null]) expect(parseBuild('s=luxilon-alu-power.silver', s)).toEqual({ build: emptyBuild(), dropped: ['string luxilon-alu-power.silver'] });
});

test('empty and junk tape pieces do not use up the 24 places', () => {
  const real24 = Array.from({ length: 24 }, (_, i) => `h${i}.10.1`);
  expect(parseBuild('l=' + '~'.repeat(40) + 'h1.10.1' + '~junk'.repeat(40) + '~h2.10.1', null).build.tape.map((p) => p.at)).toEqual([1, 2]);
  const over = parseBuild('l=' + [...real24, 'h30.10.1', 'h31.10.1'].join('~'), null);
  expect(over.build.tape).toHaveLength(24);
  expect(over.dropped).toEqual(['tape beyond 24']);
  expect(parseBuild('l=' + real24.join('~') + '~~junk~more', null).dropped).toEqual(['tape beyond 24']); // named once
});

test('chooseString: nearest 1.25 mm, the thinner on a tie, the named colour or the first', () => {
  expect(chooseString(stub('a', ['x', 'y'], [1.2, 1.3]))).toEqual({ id: 'a', colour: 'x', gaugeMm: 1.2 });
  expect(chooseString(stub('a', ['x', 'y'], [1.1, 1.3, 1.4]), 'y')).toEqual({ id: 'a', colour: 'y', gaugeMm: 1.3 });
  expect(chooseString(stub('a', ['x'], [1.0, 1.4]), 'nope')).toEqual({ id: 'a', colour: 'x', gaugeMm: 1.4 });
  expect(chooseString(stub('a', ['x'], [1.3])).gaugeMm).toBe(1.3);
  for (const s of real) expect(s.gaugesMm).toContain(chooseString(s).gaugeMm);
});

test('unknown keys, a different v, a leading ? and repeated keys are tolerated', () => {
  expect(parseBuild('?v=7&zz=1&t=60&__proto__=x&constructor=1&t=61', null)).toEqual({ build: { ...emptyBuild(), tensionLb: 61 }, dropped: [] });
});

test('a bad percent escape drops that value only', () => {
  const { build, dropped } = parseBuild('g=%E0%A4%A&d=%72ed', strings);
  expect([build.overgrip, build.dampener, dropped]).toEqual([null, 'red', ['g']]);
});

test('junk never throws', () => {
  for (const q of ['', '&&&', 's=', 's=~', 't=NaN', 'l=h', 'l=' + 'h1.10.1~'.repeat(999), '%E0%A4%A', 'x'.repeat(9999), '=', '=&=', 's=~~~', 't=~', 's=...', 'l=~~~']) {
    expect(() => parseBuild(q, strings)).not.toThrow(); expect(() => parseBuild(q, null)).not.toThrow();
  }
});

// A small seeded generator (mulberry32) keeps the random test reproducible.
function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('format then parse is stable for 500 random valid builds', () => {
  const r = rng(20261124);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T,>(xs: T[]) => xs[int(0, xs.length - 1)];
  const choice = (): StringChoice => { const s = pick(real); return { id: s.id, colour: pick(s.colours).id, gaugeMm: pick(s.gaugesMm) }; };
  for (let n = 0; n < 500; n++) {
    const b: Build = {
      mains: null, crosses: null, tensionLb: r() < 0.3 ? 52 : int(60, 150) / 2, crossTensionLb: r() < 0.5 ? null : int(60, 150) / 2,
      tape: Array.from({ length: int(0, 24) }, () => { const zone = pick(['h', 'l', 'r'] as const); return { zone, at: zone === 'h' ? int(0, 359) : int(0, 700), mirrored: r() < 0.5, lengthMm: int(10, 300), layers: int(1, 4) }; }),
      overgrip: r() < 0.5 ? null : pick(COLOURS).id, dampener: r() < 0.5 ? null : pick(COLOURS).id, yours: {},
    };
    if (r() < 0.7) { b.mains = choice(); if (r() < 0.5) b.crosses = choice(); }
    if (r() < 0.5) b.yours.g = int(150, 420);
    if (r() < 0.5) b.yours.balanceMm = int(200, 450);
    const q = formatBuild(b);
    expect(parseBuild(q, real)).toEqual({ build: b, dropped: [] });
    expect(parseBuild(q, null)).toEqual({ build: b, dropped: [] }); // unchecked choices survive too
    expect(formatBuild(parseBuild(q, real).build)).toBe(q);
    if (q) expect(q.startsWith('v=1&')).toBe(true);
  }
});
