import { test, expect } from 'bun:test';
import { gripTopY } from '../src/core/layout';
import type { RacquetSpec } from '../src/core/spec';
import { baseline, DAMPENER_G, dampenerMass, DENSITY, OVERGRIP_G, overgripMass, pitchHz, PUBLISHED_BED, REFERENCE_BED, readout, stringMasses, TAPE_G_PER_INCH, tapeMasses, type PointMass } from '../src/mass';
import { bedLines } from '../src/restring';
import { placeTape, type TapePiece } from '../src/tape';
import type { StringMaterial } from '../src/string-spec';
import { load } from './models';

const root = await load('realistic/babolat-pure-aero-100.glb');
const beds = bedLines(root)!;
const specs: RacquetSpec['specs'] = { headSizeSqIn: 100, lengthIn: 27, stringPattern: [16, 19], beamMm: [26, 26, 26] };
const strung = (material: StringMaterial, gaugeMm: number): PointMass[] => stringMasses(beds, { material, gaugeMm }, { material, gaugeMm });
const at = (g: number, x: number, y: number): PointMass => ({ g, x, y, label: 'test' });
const grams = (parts: PointMass[]) => parts.reduce((sum, p) => sum + p.g, 0);
const moment = (parts: PointMass[]) => parts.reduce((sum, p) => sum + p.g * p.y * 1000, 0); // g mm
const added = (parts: PointMass[]) => readout(specs, beds, null, parts).added;
const tape = (zone: TapePiece['zone'], at: number, more: Partial<TapePiece> = {}) => placeTape(root, beds, { zone, at, mirrored: false, lengthMm: 40, layers: 2, ...more });

test('4 g at the tip of a 27 in racquet is 13.65 kg cm²', () => {
  expect(added([at(4, 0, 0.6858)])).toEqual({ g: 4, swingweight: expect.closeTo(13.65, 2), twist: 0 });
});

test('2 g either side at 0.13 m adds 0.676 twist', () => {
  expect(added([at(2, 0.13, 0.5), at(2, -0.13, 0.5)]).twist).toBeCloseTo(0.676, 6);
});

test('300 g at 320 mm plus 15.8 g at 513 mm is 315.8 g at 329.7 mm, 4.2 points head light', () => {
  const r = readout(specs, beds, { g: 300, balanceMm: 320, from: 'published' }, [at(15.8, 0, 0.513)]);
  expect(r.weightG).toBeCloseTo(315.8, 6);
  expect(r.balanceMm).toBeCloseTo(329.7, 1);
  expect(r.pointsHeadLight).toBeCloseTo(4.2, 1);
  expect(r.about).toBe(false);
  // Head heavy is a negative number of points, and the middle is the racquet's own.
  expect(readout({ ...specs, lengthIn: 25 }, beds, { g: 240, balanceMm: 330, from: 'yours' }, []).pointsHeadLight).toBeCloseTo((317.5 - 330) / 3.175, 6);
});

test('a Pure Aero bed of 1.25 polyester is 15 to 17 g centred 505 to 520 mm up, and nylon is lighter', () => {
  const poly = strung('polyester', 1.25);
  expect(poly).toHaveLength(16 + 19);
  expect(grams(poly)).toBeGreaterThan(15); expect(grams(poly)).toBeLessThan(17);
  const centre = moment(poly) / grams(poly);
  expect(centre).toBeGreaterThan(505); expect(centre).toBeLessThan(520);
  for (const nylon of ['multifilament', 'synthetic-gut'] as const) expect(grams(strung(nylon, 1.25))).toBeCloseTo((grams(poly) * DENSITY[nylon]) / DENSITY.polyester, 6);
  expect(grams(strung('multifilament', 1.25))).toBeLessThan(grams(strung('natural-gut', 1.25)));
  expect(grams(strung('natural-gut', 1.25))).toBeLessThan(grams(poly));
  expect(grams(strung('polyester', 1.3))).toBeCloseTo(grams(poly) * (1.3 / 1.25) ** 2, 6);
});

test('a string’s mass is spread along it, not at its middle', () => {
  const bed = added(strung('polyester', 1.25));
  expect(bed.swingweight).toBeCloseTo(27.75, 1); // the design doc's check on this bed
  const points = added(strung('polyester', 1.25).map(({ g, x, y }) => at(g, x, y)));
  expect(bed.swingweight - points.swingweight).toBeCloseTo(0.58, 1);
  expect(bed.twist - points.twist).toBeCloseTo(0.28, 1); // the crosses reach out to the sides
});

test('a hybrid weighs its mains and crosses separately', () => {
  const hybrid = stringMasses(beds, { material: 'natural-gut', gaugeMm: 1.3 }, { material: 'polyester', gaugeMm: 1.2 });
  expect(hybrid.slice(0, 16)).toEqual(strung('natural-gut', 1.3).slice(0, 16));
  expect(hybrid.slice(16)).toEqual(strung('polyester', 1.2).slice(16));
});

test('pitch rises with tension, falls with gauge, and 1.25 polyester at 52 lb is 540 to 600 Hz on a Pure Aero', () => {
  const hz = (gaugeMm: number, lb: number, material: StringMaterial = 'polyester') => pitchHz(beds, { material, gaugeMm }, lb);
  expect(hz(1.25, 52)).toBeGreaterThan(540); expect(hz(1.25, 52)).toBeLessThan(600);
  expect(hz(1.25, 57)).toBeGreaterThan(hz(1.25, 52));
  expect(hz(1.35, 52)).toBeLessThan(hz(1.25, 52));
  expect(hz(1.25, 52, 'multifilament')).toBeGreaterThan(hz(1.25, 52)); // lighter sings higher
  // The centre main, not the longest or the first.
  const other = { ...beds, mains: { ...beds.mains, lines: [{ at: -0.1, from: 0.4, to: 0.5 }, { at: 0.006, from: 0.35, to: 0.65 }] } };
  expect(pitchHz(other, { material: 'polyester', gaugeMm: 1.25 }, 52)).toBeCloseTo((hz(1.25, 52) * (beds.mains.lines[7].to - beds.mains.lines[7].from)) / 0.3, 6);
});

test('no weight and no balance: nulls, but added is still right', () => {
  expect(baseline(specs, beds)).toBeNull();
  const r = readout(specs, beds, null, [at(4, 0.1, 0.6858)]);
  expect(r).toEqual({
    weightG: null, balanceMm: null, pointsHeadLight: null, about: false, weightAbout: false, swingweight: null,
    added: { g: 4, swingweight: expect.closeTo(13.65, 2), twist: expect.closeTo(0.4, 6) },
    addedPlay: { swingweight: expect.any(Number), twist: expect.any(Number) },
  });
});

const published = { ...specs, unstrungWeightG: 300, balanceMm: 320 };
const figures = { ...specs, strungWeightG: 318, strungBalanceMm: 328 };

test('derived is marked about; yours beats published; a weight without a balance gives weight only', () => {
  const synGut = strung('synthetic-gut', 1.3);
  const derived = baseline(figures, beds)!;
  expect(derived.from).toBe('derived');
  expect(derived.g).toBeCloseTo(318 - grams(synGut), 6);
  // Strung again with that bed, it is back at the published strung figures.
  const back = readout(figures, beds, derived, synGut);
  expect(back.weightG).toBeCloseTo(318, 6); expect(back.balanceMm).toBeCloseTo(328, 6); expect(back).toMatchObject({ about: true, weightAbout: true });

  expect(baseline(published, beds)).toEqual({ g: 300, balanceMm: 320, from: 'published' });
  expect(baseline({ ...published, ...figures }, beds)).toEqual({ g: 300, balanceMm: 320, from: 'published' });
  expect(baseline(published, beds, { g: 305, balanceMm: 325 })).toEqual({ g: 305, balanceMm: 325, from: 'yours' });

  const weighed = readout({ ...specs, unstrungWeightG: 300 }, beds, baseline({ ...specs, unstrungWeightG: 300 }, beds), [at(10, 0, 0.5)]);
  expect(weighed).toMatchObject({ weightG: 310, balanceMm: null, pointsHeadLight: null, about: false, weightAbout: false });
  // A strung weight alone is about, less the bed.
  const strungOnly = readout({ ...specs, strungWeightG: 318 }, beds, null, synGut);
  expect(strungOnly).toMatchObject({ balanceMm: null, about: true, weightAbout: true });
  expect(strungOnly.weightG).toBeCloseTo(318, 6);
});

test('a published weight shows as published when only the balance is derived', () => {
  const both = { ...figures, unstrungWeightG: 300 };
  const synGut = strung('synthetic-gut', 1.3);
  const base = baseline(both, beds)!;
  expect(base.from).toBe('derived');
  const r = readout(both, beds, base, []);
  expect(r).toMatchObject({ weightG: 300, about: true, weightAbout: false });
  expect(r.balanceMm).toBeCloseTo((318 * 328 - moment(synGut)) / (318 - grams(synGut)), 6);
  // The balance still comes back to the published strung one under the bed it was derived with.
  const back = readout(both, beds, base, synGut);
  expect(back.weightG).toBeCloseTo(300 + grams(synGut), 6);
  expect(back.balanceMm).toBeCloseTo(328, 6);
  // Yours and the maker's pair are theirs in full.
  for (const b of [baseline(both, beds, { g: 305, balanceMm: 325 })!, baseline({ ...both, balanceMm: 320 }, beds)!]) expect(readout(both, beds, b, [])).toMatchObject({ weightG: b.g, about: false, weightAbout: false });
});

test('numbers of different kinds are never paired', () => {
  expect(baseline({ ...specs, unstrungWeightG: 300, strungBalanceMm: 328 }, beds)).toBeNull();
  expect(baseline({ ...specs, strungWeightG: 318, balanceMm: 320 }, beds)).toBeNull();
  expect(baseline({ ...specs, balanceMm: 320 }, beds, { g: 305 })).toBeNull(); // yours with a published balance
  expect(baseline(published, beds, { g: 305 })).toEqual({ g: 300, balanceMm: 320, from: 'published' }); // half of yours: the published pair stays
  expect(baseline(figures, beds, { balanceMm: 325 })!.from).toBe('derived');
});

test('swingweight is the published strung figure with the strings swapped for the parts', () => {
  const rated = { ...specs, swingweight: 320 };
  expect(PUBLISHED_BED).toEqual({ material: 'synthetic-gut', gaugeMm: 1.3 });
  const synGut = strung('synthetic-gut', 1.3);
  expect(readout(rated, beds, null, synGut).swingweight).toBeCloseTo(320, 6);
  expect(readout(rated, beds, null, [...synGut, at(4, 0, 0.6858)]).swingweight).toBeCloseTo(333.65, 2);
  expect(readout(rated, beds, null, strung('polyester', 1.25)).swingweight!).toBeGreaterThan(320);
});

test('the reference build has zero addedPlay', () => {
  expect(REFERENCE_BED).toEqual({ material: 'polyester', gaugeMm: 1.25 });
  const r = readout(published, beds, baseline(published, beds), strung('polyester', 1.25));
  expect(r.addedPlay).toEqual({ swingweight: 0, twist: 0 });
  expect(r.added.g).toBeGreaterThan(15); // the strings still count as put on
  const taped = readout(published, beds, null, [...strung('polyester', 1.25), at(4, 0, 0.6858)]);
  expect(taped.addedPlay.swingweight).toBeCloseTo(13.65, 2);
  // A lighter bed counts as less than nothing added, and no strings at all as the whole bed missing.
  expect(readout(published, beds, null, strung('synthetic-gut', 1.25)).addedPlay.swingweight).toBeCloseTo(27.755 * (1140 / 1380 - 1), 2);
  const bare = readout(published, beds, null, []);
  expect(bare.addedPlay.swingweight).toBeCloseTo(-27.755, 2);
  expect(bare.addedPlay.twist).toBeCloseTo(-0.578, 2);
});

test('12 o’clock tape moves balance up, handle tape moves it down, both raise weight', () => {
  const base = { g: 300, balanceMm: 320, from: 'published' as const };
  const strings = strung('polyester', 1.25);
  const bare = readout(specs, beds, base, strings);
  const tip = readout(specs, beds, base, [...strings, ...tapeMasses(tape('h', 0))]);
  const handle = readout(specs, beds, base, [...strings, ...tapeMasses(tape('l', 100, { mirrored: true }))]);
  expect(tip.balanceMm!).toBeGreaterThan(bare.balanceMm!);
  expect(handle.balanceMm!).toBeLessThan(bare.balanceMm!);
  expect(tip.weightG!).toBeGreaterThan(bare.weightG!); expect(handle.weightG!).toBeGreaterThan(bare.weightG!);
});

test('tape weighs its asked length times its layers, once a side, at its middle', () => {
  const placed = tape('h', 90, { mirrored: true });
  const masses = tapeMasses(placed);
  expect(masses).toHaveLength(2);
  masses.forEach((m, i) => {
    expect(m.g).toBeCloseTo((40 / 25.4) * 2 * TAPE_G_PER_INCH, 9);
    expect([m.x, m.y]).toEqual([placed[i].centroid.x, placed[i].centroid.y]);
  });
  expect(added(masses).twist).toBeGreaterThan(0.2);
  expect(tapeMasses([])).toEqual([]);
});

test('an overgrip lies along the handle and a dampener is on the lowest cross', () => {
  for (const lengthIn of [21, 25, 27, 28]) {
    const grip = overgripMass(lengthIn);
    expect(grip).toMatchObject({ g: OVERGRIP_G, x: 0 });
    expect(grip.y).toBeCloseTo(gripTopY(lengthIn) / 2, 9);
    expect(grip.y).toBeLessThan(0.1);
  }
  const damp = dampenerMass(beds);
  expect(damp.g).toBe(DAMPENER_G);
  expect(damp.x).toBeCloseTo(0, 9);
  expect(damp.y).toBe(Math.min(...beds.crosses.lines.map((l) => l.at)));
  expect(damp.y - beds.mains.lines[7].from).toBeGreaterThan(0.003);
});
