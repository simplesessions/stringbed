import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { estimate, PLAY_KEYS, verdict, type PlayInput, type PlayKey } from '../src/play';
import type { StringMaterial, StringSpec } from '../src/string-spec';

const fixture = (material: StringMaterial, brand: string, name: string, r = 3, over: Partial<StringSpec['ratings']> = {}): StringSpec => ({
  id: `${brand}-${name}`.toLowerCase().replace(/\W+/g, '-'), brand, name, material, shape: null, gaugesMm: [1.25], colours: [{ id: 'natural', name: 'Natural', hex: '#d8c9a8' }], finish: 'matte',
  summary: '', bestFor: ['spin'], ratings: { power: r, spin: r, control: r, comfort: r, feel: r, durability: r, ...over }, compared: [], confidence: 'high', sources: [], researchedOn: '2026-11-24', verified: false,
});
const poly = fixture('polyester', 'Acme', 'Bite', 3);
const multi = fixture('multifilament', 'Acme', 'Soft', 3);
const synth = fixture('synthetic-gut', 'Acme', 'Basic', 3);
const gut = fixture('natural-gut', 'Acme', 'Gut', 3);
const spinner = fixture('polyester', 'Acme', 'Twist', 3, { spin: 5 });

const flat = { power: 3, spin: 3, control: 3, comfort: 3, stability: 3, maneuverability: 3, feel: 3 };
const setup = (s: StringSpec, over: Partial<{ gaugeMm: number; tensionLb: number }> = {}) => ({ string: s, gaugeMm: 1.25, tensionLb: 52, ...over });
const make = (over: Partial<PlayInput> = {}): PlayInput => ({
  racquet: { name: 'Test 100', ratings: flat, pattern: [16, 19], junior: false },
  mains: setup(poly), crosses: setup(poly), addedPlay: { swingweight: 0, twist: 0 }, ...over,
});
const row = (i: PlayInput, key: PlayKey) => estimate(i).find((r) => r.key === key)!;

test('the reference build shifts nothing', () => {
  for (const r of estimate(make({ racquet: { ...make().racquet, ratings: flat } }))) {
    expect(r.shift).toBe(0);
    expect(r.reasons).toEqual([]);
  }
  expect(estimate(make()).map((r) => r.key)).toEqual([...PLAY_KEYS]);
});

test.each([['tensionLb', 'power', -1], ['tensionLb', 'comfort', -1], ['tensionLb', 'control', 1], ['gaugeMm', 'durability', 1], ['gaugeMm', 'spin', -1]] as const)('more %s moves %s the right way', (field, key, sign) => {
  const more = { [field]: field === 'tensionLb' ? 57 : 1.30 };
  const i = make({ mains: setup(poly, more), crosses: setup(poly, more) });
  expect(Math.sign(row(i, key).shift)).toBe(sign);
});

test('tension stops counting beyond three steps', () => {
  const at = (t: number) => estimate(make({ mains: setup(poly, { tensionLb: t }), crosses: setup(poly, { tensionLb: t }) })).map((r) => r.shift);
  expect(at(67)).toEqual(at(80));
  expect(at(37)).toEqual(at(20));
});

test('values stay within 1 and 5 for every racquet profile and every string at 30 and 75 lb', () => {
  const strings = [...(JSON.parse(readFileSync(`${import.meta.dir}/../assets/strings.json`, 'utf8')).strings as StringSpec[]), poly, multi, synth, gut];
  const profiles = readdirSync(`${import.meta.dir}/../profiles`).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(`${import.meta.dir}/../profiles/${f}`, 'utf8')) as Array<{ id: string; ratings: PlayInput['racquet']['ratings'] }>);
  expect(profiles.length).toBeGreaterThan(0);
  for (const p of profiles) for (const s of strings) for (const t of [30, 75]) for (const g of [s.gaugesMm[0], s.gaugesMm.at(-1)!]) {
    const i = make({ racquet: { name: p.id, ratings: p.ratings, pattern: [16, 19], junior: false }, mains: setup(s, { tensionLb: t, gaugeMm: g }), crosses: setup(s, { tensionLb: t, gaugeMm: g }), addedPlay: { swingweight: 40, twist: 3 } });
    for (const r of estimate(i)) {
      expect(Number.isFinite(r.shift)).toBe(true);
      if (r.value !== null) { expect(r.value).toBeGreaterThanOrEqual(1); expect(r.value).toBeLessThanOrEqual(5); }
    }
  }
});

test('mains outweigh crosses', () => {
  const a = estimate(make({ mains: setup(gut), crosses: setup(spinner) }));
  const b = estimate(make({ mains: setup(spinner), crosses: setup(gut) }));
  // spin 5 against 3: the spinner in the mains gives 0.65 × 2 × 0.35, in the crosses 0.35 × 2 × 0.35
  expect(a.find((r) => r.key === 'spin')!.shift).toBeCloseTo(0.35 * 2 * 0.35);
  expect(b.find((r) => r.key === 'spin')!.shift).toBeCloseTo(0.65 * 2 * 0.35);
});

test('no profile: base and value null, shifts still there', () => {
  const rows = estimate(make({ racquet: { ...make().racquet, ratings: null }, mains: setup(spinner), crosses: setup(spinner) }));
  for (const r of rows.filter((r) => r.key !== 'durability')) { expect(r.base).toBeNull(); expect(r.value).toBeNull(); }
  expect(rows.find((r) => r.key === 'spin')!.shift).toBeCloseTo(0.7);
  // durability is the strings' own, so it survives without a profile
  expect(rows.find((r) => r.key === 'durability')!.value).toBe(3);
});

test('reasons name their cause and add up', () => {
  const i = make({ mains: setup(spinner, { tensionLb: 62, gaugeMm: 1.15 }), crosses: setup(spinner, { tensionLb: 62, gaugeMm: 1.15 }), addedPlay: { swingweight: 10, twist: 0 } });
  const r = row(i, 'power');
  expect(r.reasons.map((x) => x.text).sort()).toEqual(['1.15 mm gauge', '62 lb tension', 'Weight added']);
  expect(r.reasons.length).toBeLessThanOrEqual(3);
  expect(r.reasons.some((x) => x.text === '62 lb tension' && x.shift < 0)).toBe(true);
  expect(r.reasons.some((x) => x.text === 'Weight added' && x.shift === 0.1)).toBe(true);
  // power: tension -0.5, weight +0.1, gauge +0.1, strings 0 -> all at or above the cut, they sum to the shift
  expect(r.reasons.reduce((s, x) => s + x.shift, 0)).toBeCloseTo(r.shift);
  expect(Math.abs(r.reasons[0].shift)).toBeGreaterThanOrEqual(Math.abs(r.reasons[1].shift));
  const spin = row(i, 'spin');
  expect(spin.reasons[0].text).toBe('Acme Twist');
});

const verdicts = (i: PlayInput) => verdict(i);
const cases: Array<[string, PlayInput, string]> = [
  ['junior polyester', make({ racquet: { ...make().racquet, junior: true } }), 'young arm'],
  ['stiff poly', make({ mains: setup(poly, { tensionLb: 58 }), crosses: setup(poly, { tensionLb: 58 }) }), 'stiff and unforgiving'],
  ['open pattern spin', make({ racquet: { ...make().racquet, pattern: [16, 18] }, mains: setup(spinner, { gaugeMm: 1.15 }), crosses: setup(spinner, { gaugeMm: 1.15 }) }), 'grab the ball'],
  ['dense pattern spin string', make({ racquet: { ...make().racquet, pattern: [18, 20] }, mains: setup(spinner), crosses: setup(multi) }), 'holds back'],
  ['gut and poly hybrid', make({ mains: setup(gut), crosses: setup(poly) }), 'brings the power and comfort'],
  ['weight up', make({ addedPlay: { swingweight: 9, twist: 0 } }), 'slower to swing'],
  ['weight down', make({ addedPlay: { swingweight: -4, twist: 0 } }), 'quicker through the swing'],
  ['biggest rise', make({ mains: setup(spinner), crosses: setup(spinner) }), 'gains most in spin'],
  ['biggest fall', make({ mains: setup(poly, { tensionLb: 62 }), crosses: setup(poly, { tensionLb: 62 }) }), 'gives up most in'],
];
test.each(cases)('verdict: %s', (_n, input, fragment) => {
  expect(verdicts(input).some((s) => s.includes(fragment))).toBe(true);
});

test('the default sentence is exact, and alone', () => {
  expect(verdict(make())).toEqual(['Close to how the Test 100 plays as it comes.']);
});

test('triggers keep their order and stop at three', () => {
  const i = make({ racquet: { ...make().racquet, junior: true }, mains: setup(gut, { tensionLb: 62 }), crosses: setup(poly, { tensionLb: 62 }), addedPlay: { swingweight: 12, twist: 0 } });
  const v = verdict(i);
  expect(v.length).toBe(3);
  expect(v[0]).toContain('young arm');
  expect(v[1]).toContain('brings the power and comfort');
  expect(v[2]).toContain('slower to swing');
});

test('verdict is one to three sentences for every racquet with every string', () => {
  const strings = [...(JSON.parse(readFileSync(`${import.meta.dir}/../assets/strings.json`, 'utf8')).strings as StringSpec[]), poly, multi, synth, gut];
  const profiles = readdirSync(`${import.meta.dir}/../profiles`).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(`${import.meta.dir}/../profiles/${f}`, 'utf8')) as Array<{ id: string; ratings: PlayInput['racquet']['ratings'] }>);
  for (const p of profiles) for (const s of strings) for (const junior of [false, true]) {
    const v = verdict(make({ racquet: { name: p.id, ratings: p.ratings, pattern: [18, 20], junior }, mains: setup(s, { tensionLb: 60 }), crosses: setup(s, { tensionLb: 60 }), addedPlay: { swingweight: 10, twist: 0 } }));
    expect(v.length).toBeGreaterThanOrEqual(1);
    expect(v.length).toBeLessThanOrEqual(3);
    for (const line of v) expect(line.split(/\s+/).length).toBeLessThanOrEqual(30);
  }
});

test('junior polyester is cautioned; junior multifilament is not', () => {
  const junior = { ...make().racquet, junior: true };
  expect(verdict(make({ racquet: junior })).join(' ')).toContain('young arm');
  expect(verdict(make({ racquet: junior, mains: setup(multi), crosses: setup(multi) })).join(' ')).not.toContain('young arm');
});

// Every coefficient of the design doc's table, exactly (shifts are rounded to 3 decimals when built).
const at = (s: StringSpec, o: Partial<{ gaugeMm: number; tensionLb: number }> = {}) => make({ mains: setup(s, o), crosses: setup(s, o) });
const shifts = (i: PlayInput) => Object.fromEntries(estimate(i).map((r) => [r.key, r.shift]));
const ZERO = { power: 0, spin: 0, control: 0, comfort: 0, stability: 0, maneuverability: 0, feel: 0, durability: 0 };

test('row 1: each point of string rating above 3 is 0.35 on power, spin, control, comfort and feel', () => {
  for (const key of ['power', 'spin', 'control', 'comfort', 'feel'] as const) {
    expect(shifts(at(fixture('polyester', 'Acme', 'Hi', 3, { [key]: 4 })))).toEqual({ ...ZERO, [key]: 0.35 });
    expect(shifts(at(fixture('polyester', 'Acme', 'Lo', 3, { [key]: 1 })))).toEqual({ ...ZERO, [key]: -0.7 });
  }
});

test('row 2: 5 lb above 52 is power -0.25, control +0.2, comfort -0.25, spin -0.05', () => {
  expect(shifts(at(poly, { tensionLb: 57 }))).toEqual({ ...ZERO, power: -0.25, control: 0.2, comfort: -0.25, spin: -0.05 });
  expect(shifts(at(poly, { tensionLb: 47 }))).toEqual({ ...ZERO, power: 0.25, control: -0.2, comfort: 0.25, spin: 0.05 });
});

test('row 3: 0.05 mm thinner is spin +0.08, feel +0.08, power +0.05, control -0.04, durability -0.3', () => {
  expect(shifts(at(poly, { gaugeMm: 1.2 }))).toEqual({ ...ZERO, spin: 0.08, feel: 0.08, power: 0.05, control: -0.04, durability: -0.3 });
  expect(shifts(at(poly, { gaugeMm: 1.3 }))).toEqual({ ...ZERO, spin: -0.08, feel: -0.08, power: -0.05, control: 0.04, durability: 0.3 });
});

test('row 4: 10 kg·cm² of swingweight is stability +0.3, manoeuvrability -0.35, power +0.1', () => {
  expect(shifts(make({ addedPlay: { swingweight: 10, twist: 0 } }))).toEqual({ ...ZERO, stability: 0.3, maneuverability: -0.35, power: 0.1 });
});

test('row 5: 0.5 kg·cm² of twist is stability +0.1', () => {
  expect(shifts(make({ addedPlay: { swingweight: 0, twist: 0.5 } }))).toEqual({ ...ZERO, stability: 0.1 });
});

test('a reason of exactly 0.1 shows, whatever the floating-point noise', () => {
  // 0.05 mm thinner on the mains only is 0.65 of a step: power 0.0325 stays below the cut; a full 2 steps of the 0.05 coefficient is exactly 0.1.
  const r = row(at(poly, { gaugeMm: 1.15 }), 'power');
  expect(r.shift).toBe(0.1);
  expect(r.reasons).toEqual([{ text: '1.15 mm gauge', shift: 0.1 }]);
});

test('no gains-most sentence when the clamped value did not move', () => {
  // power already 5 on this profile: the lift is real in the shift but not in the value.
  const top = { ...flat, power: 5 };
  const i = make({ racquet: { ...make().racquet, ratings: top }, mains: setup(fixture('polyester', 'Acme', 'Big', 3, { power: 5 })), crosses: setup(fixture('polyester', 'Acme', 'Big', 3, { power: 5 })) });
  expect(row(i, 'power').value).toBe(5);
  expect(verdict(i).join(' ')).not.toContain('gains most in power');
  expect(verdict(i)).toEqual(['Close to how the Test 100 plays as it comes.']);
});

describe('unrated strings (null): nobody knows what they are', () => {
  const none = { string: null, gaugeMm: 1.25, tensionLb: 52 };
  const unrated = (over: Partial<PlayInput> = {}) => make({ mains: none, crosses: none, ...over });

  test('shift nothing by themselves, and durability has nothing to start from', () => {
    for (const r of estimate(unrated())) {
      expect(r.shift).toBe(0);
      expect(r.reasons).toEqual([]);
      if (r.key === 'durability') expect([r.base, r.value]).toEqual([null, null]);
      else expect(r.value).toBe(r.base);
    }
    expect(verdict(unrated())).toEqual(['Close to how the Test 100 plays as it comes.']);
  });
  test('tension and weight still shift', () => {
    const i = unrated({ mains: { ...none, tensionLb: 57 }, crosses: { ...none, tensionLb: 57 }, addedPlay: { swingweight: 10, twist: 0 } });
    expect(shifts(i)).toEqual({ ...ZERO, power: -0.15, control: 0.2, comfort: -0.25, spin: -0.05, stability: 0.3, maneuverability: -0.35 });
    expect(estimate(i).flatMap((r) => r.reasons.map((x) => x.text)).sort()).toEqual(['57 lb tension', '57 lb tension', '57 lb tension', 'Weight added', 'Weight added', 'Weight added'].sort());
  });
  test('no sentence claims a material, whatever the tension, pattern or age', () => {
    for (const pattern of [[16, 18], [18, 20]] as Array<[number, number]>) {
      const i = unrated({ racquet: { name: 'Test 100', ratings: flat, pattern, junior: true }, mains: { ...none, tensionLb: 70 }, crosses: { ...none, tensionLb: 70 } });
      expect(verdict(i).join(' ')).not.toMatch(/polyester|hybrid|grab the ball|dense|stock|null|undefined/i);
    }
  });
  test('one known set counts with its own weight, and the other counts as middling', () => {
    const hi = fixture('polyester', 'Acme', 'Hi', 3, { spin: 5 });
    expect(row(make({ mains: setup(hi), crosses: none }), 'spin').shift).toBe(0.455); // 0.35 x 2 x 0.65
    expect(row(make({ mains: setup(hi), crosses: none }), 'spin').reasons[0].text).toBe('Acme Hi with stock strings');
    expect(row(make({ mains: setup(hi), crosses: none }), 'durability').base).toBeNull();
  });
});

test('gains and losses are named by how far the rating moves, not by how far it would like to', () => {
  // Power wants +0.7 from 4.5 and can have 0.5; spin wants +0.6 from 3 and gets it.
  const string = fixture('polyester', 'Acme', 'Two', 3, { power: 5, spin: 4 });
  const high = { ...flat, power: 4.6 };
  const i = make({ racquet: { ...make().racquet, ratings: high, pattern: [18, 19] }, mains: setup(string), crosses: setup(string) });
  expect(row(i, 'power')).toMatchObject({ value: 5, shift: 0.7 });
  expect(verdict(i)).toContain('The Test 100 gains most in power, by about 0.4 of a point.');
  const higher = make({ racquet: { ...i.racquet, ratings: { ...flat, power: 4.8 } }, mains: setup(string), crosses: setup(string) });
  expect(verdict(higher)).toContain('The Test 100 gains most in spin, by about 0.3 of a point.'); // 0.35 of spin beats the 0.2 power can have
  const low = make({ racquet: { ...i.racquet, ratings: { ...flat, comfort: 1.2 } }, mains: setup(poly, { tensionLb: 67 }), crosses: setup(poly, { tensionLb: 67 }) });
  expect(row(low, 'comfort').shift).toBe(-0.75);
  expect(verdict(low).join(' ')).not.toContain('gives up most in comfort');
});

test('every gain or loss that is said is the biggest there is, to the rounding of what is said', () => {
  const strings = JSON.parse(readFileSync(`${import.meta.dir}/../assets/strings.json`, 'utf8')).strings as StringSpec[];
  const profiles = readdirSync(`${import.meta.dir}/../profiles`).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(`${import.meta.dir}/../profiles/${f}`, 'utf8')) as Array<{ ratings: PlayInput['racquet']['ratings'] }>);
  const names = { power: 'power', spin: 'spin', control: 'control', comfort: 'comfort', stability: 'stability', manoeuvrability: 'maneuverability', feel: 'feel', durability: 'durability' } as Record<string, PlayKey>;
  let said = 0;
  for (const p of profiles) for (const s of strings) for (const t of [30, 45, 52, 60, 67, 75]) {
    const i = make({ racquet: { name: 'X', ratings: p.ratings, pattern: [16, 19], junior: false }, mains: setup(s, { tensionLb: t }), crosses: setup(s, { tensionLb: t }) });
    const moves = new Map(estimate(i).map((r) => [r.key, r.value === null || r.base === null ? r.shift : r.value - r.base]));
    for (const line of verdict(i)) {
      const m = /(gains most|gives up most) in (\w+), by about ([\d.]+)/.exec(line);
      if (!m) continue;
      said++;
      const move = moves.get(names[m[2]])! * (m[1] === 'gains most' ? 1 : -1);
      if (Math.abs(move - Number(m[3])) > 0.0501) throw new Error(`${line} beside a row moving ${move}`);
      const best = Math.max(...[...moves.values()].map((v) => (m[1] === 'gains most' ? v : -v)));
      if (best - move > 1e-9) throw new Error(`${line} but another row moves ${best}`);
    }
  }
  expect(said).toBeGreaterThan(1000);
}, 60_000);

test('no more-spin sentence beside a spin rating that is already at 5', () => {
  const at = (spin: number) => verdict(make({ racquet: { name: 'Test 100', ratings: { ...flat, spin }, pattern: [16, 18], junior: false }, mains: setup(spinner), crosses: setup(spinner) })).join(' ');
  expect(at(3)).toContain('noticeably more spin');
  expect(at(5)).not.toContain('noticeably more spin');
});
