import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bedLines, type Beds } from '../../src/restring';
import { placeTape, tapeAt, type TapePiece } from '../../src/tape';
import { Vector3 } from 'three';
import { emptyBuild, chooseString, parseBuild, formatBuild, type Build } from '../../site/src/build-state';
import type { StringSpec } from '../../src/string-spec';
import type { Racquet } from '../../site/src/catalog-view';
import { PLAY_KEYS } from '../../src/play';
import {
  addPiece, aimStep, announcement, beamPose, chosenStrings, provenance, ratingsWord, yoursHint, cleanMeasure, droppedNotice, figures, gramsOf, mirrored, moveOf, moved, nearestPiece, onBed, playInput,
  presetPiece, PRESETS, readoutCells, sideEnd, snapped, stringList, tapeName, tensionText, type Figures,
} from '../../site/src/build-view';
import { catalog, load } from '../models';

const strings: StringSpec[] = JSON.parse(readFileSync(join(import.meta.dir, '../../assets/strings.json'), 'utf8')).strings;
const specsOf = (id: string) => catalog.racquets.find((r) => r.id === id)!.specs;
const named = (id: string) => strings.find((s) => s.id === id)!;
const piece = (zone: TapePiece['zone'], at: number, more: Partial<TapePiece> = {}): TapePiece => ({ zone, at, mirrored: false, lengthMm: 80, layers: 1, ...more });
const build = (more: Partial<Build>): Build => ({ ...emptyBuild(), ...more });

const PUBLISHED = 'babolat-pure-drive-100'; // weight and balance
const DERIVED = 'wilson-blade-98-v10'; // weight only; its strung figures below are made up (no racquet has any today)
const BARE = 'head-speed-junior-25'; // nothing
const models = new Map<string, { root: Awaited<ReturnType<typeof load>>; beds: Beds }>();
async function model(id: string) {
  if (!models.has(id)) {
    const root = await load(`realistic/${id}.glb`);
    models.set(id, { root, beds: bedLines(root)! });
  }
  return models.get(id)!;
}
async function figuresFor(id: string, b: Build): Promise<Figures> {
  const { root, beds } = await model(id);
  return figures(specsOf(id), beds, b, chosenStrings(b, strings), b.tape.flatMap((p) => placeTape(root, beds, p)));
}

describe('figures', () => {
  test('a build with nothing on it changes nothing', async () => {
    const f = await figuresFor(PUBLISHED, emptyBuild());
    expect(f.weight.from).toBe('published');
    expect(f.weight.about).toBe(false);
    expect(f.weight.change).toBeCloseTo(0, 9);
    expect(f.balance.change).toBeCloseTo(0, 9);
    expect(f.swingweight.change).toBeCloseTo(0, 9);
    expect(f.twist).toBeCloseTo(0, 9);
    expect(f.weight.value!).toBeGreaterThan(310); // 300 g bare, and a bed of 1.25 polyester
    expect(f.weight.value!).toBeLessThan(322);
    expect(f.extras).toBeNull();
  });
  test('tape, grip and dampener are counted, and say where they sit', async () => {
    const b = build({ tape: [piece('h', 0)], overgrip: 'white', dampener: 'red' });
    const f = await figuresFor(PUBLISHED, b);
    expect(f.weight.change).toBeCloseTo((80 / 25.4) * 0.25 + 4.9 + 2.9, 6);
    expect(f.extras!.g).toBeCloseTo(f.weight.change, 6);
    expect(f.extras!.centreMm).toBeGreaterThan(100);
    expect(f.extras!.centreMm).toBeLessThan(400);
    expect(f.swingweight.change).toBeGreaterThan(0);
  });
  test('derived numbers say about, and a published weight beside them does not', async () => {
    const { beds } = await model(DERIVED);
    const b = emptyBuild();
    const f = figures({ ...specsOf(DERIVED), strungWeightG: 322, strungBalanceMm: 328, swingweight: 320 }, beds, b, chosenStrings(b, strings), []);
    expect(f.weight).toMatchObject({ from: 'published', about: false });
    expect(f.balance.about).toBe(true);
    expect(f.balance.value).not.toBeNull();
    const cells = readoutCells(f);
    expect(cells.weight.value).not.toContain('about');
    expect(cells.balance.value).toContain('about');
    expect(cells.swingweight.value).toContain('about');
  });
  test('nothing published: the changes are still there', async () => {
    const b = build({ tape: [piece('h', 0)] });
    const f = await figuresFor(BARE, b);
    expect(f.weight.value).toBeNull();
    expect(f.balance.value).toBeNull();
    expect(f.swingweight.value).toBeNull();
    const cells = readoutCells(f);
    for (const k of ['weight', 'balance', 'swingweight'] as const) expect(cells[k].value).toBe('Not published');
    expect(cells.weight.change).toBe('+0.8 g');
    expect(cells.balance.change).toMatch(/^\+0\.8 g at \d{3} mm$/);
    expect(cells.balance.against).toBe('tape, grip and dampener'); // strings are not in that one
    expect(cells.weight.against).toBe('vs stock strings');
    expect(cells.swingweight.change).toMatch(/^\+\d/);
  });
  test('your own weight and balance are used and labelled yours', async () => {
    const f = await figuresFor(BARE, build({ yours: { g: 250, balanceMm: 300 } }));
    expect(f.weight).toMatchObject({ from: 'yours', about: false });
    expect(f.balance.value).not.toBeNull();
    expect(readoutCells(f).weight.note).toContain('yours');
  });
  test('only your weight: shown as yours, never as published, and no balance beside it', async () => {
    for (const id of [PUBLISHED, DERIVED, BARE]) {
      const f = await figuresFor(id, build({ yours: { g: 333 } }));
      expect(f.weight.from).toBe('yours');
      expect(f.weight.value! - f.weight.added).toBeCloseTo(333, 9);
      expect(f.balance.value).toBeNull();
      expect(readoutCells(f).balance.value).toBe('Not given');
    }
  });
  test('only your balance: not enough, so what is published stands', async () => {
    const [a, b] = [await figuresFor(PUBLISHED, build({ yours: { balanceMm: 350 } })), await figuresFor(PUBLISHED, emptyBuild())];
    expect(a).toEqual(b);
  });
  test('a heavier string weighs more than stock, a lighter one less', async () => {
    const gut = build({ mains: { ...chooseString(named('luxilon-alu-power')), gaugeMm: 1.35 } });
    const nylon = build({ mains: { ...chooseString(strings.find((s) => s.material === 'multifilament')!), gaugeMm: 1.2 } });
    expect((await figuresFor(PUBLISHED, gut)).weight.change).toBeGreaterThan(1);
    expect((await figuresFor(PUBLISHED, nylon)).weight.change).toBeLessThan(-1);
  });
});

describe('where the numbers start', () => {
  const specs = (more: Partial<Racquet['specs']>): Racquet['specs'] => ({ headSizeSqIn: 100, lengthIn: 27, stringPattern: [16, 19], beamMm: [23, 23, 23], ...more });
  const published = specs({ unstrungWeightG: 300, balanceMm: 320, strungWeightG: 318, strungBalanceMm: 330 });
  test('yours before the maker\u2019s, the maker\u2019s before what is worked back, and nothing made up', () => {
    expect(provenance(published, { g: 290, balanceMm: 325 })).toBe('Starting from your own 290 g and 325 mm, unstrung.');
    expect(provenance(published, { g: 290 })).toBe('Starting from your own 290 g, unstrung. No balance given, so none is shown.');
    expect(provenance(published, { balanceMm: 325 })).toBe('Starting from the published 300 g and 320 mm, unstrung.');
    expect(provenance(published, {})).toBe('Starting from the published 300 g and 320 mm, unstrung.');
    expect(provenance(specs({ unstrungWeightG: 305, strungWeightG: 323, strungBalanceMm: 330 }), {})).toBe('The weight starts from the published 305 g unstrung. The balance is 323 g and 330 mm strung, less a plain bed of 1.3 mm nylon, so it is about right.');
    expect(provenance(specs({ strungWeightG: 323, strungBalanceMm: 330 }), {})).toBe('Starting from 323 g and 330 mm strung, less a plain bed of 1.3 mm nylon, so it is about right.');
    expect(provenance(specs({ unstrungWeightG: 305 }), {})).toBe('Starting from the published 305 g unstrung. No balance is published for this racquet.');
    expect(provenance(specs({}), {})).toBe('No weight or balance is published for this racquet, so only what you add can be worked out.');
  });
  test('the sentence agrees with the figures, on every racquet there is', async () => {
    for (const r of catalog.racquets) {
      const line = provenance(r.specs, {});
      expect(/No (weight or )?balance is published|No weight or balance/.test(line)).toBe(!(r.specs.unstrungWeightG && r.specs.balanceMm) && !(r.specs.strungWeightG && r.specs.strungBalanceMm));
    }
  });
  test('half of yours asks for the other half', () => {
    expect(yoursHint({})).toBe('');
    expect(yoursHint({ g: 290 })).toBe('Add the balance too.');
    expect(yoursHint({ balanceMm: 325 })).toBe('Add the weight too: the balance is not used without it.');
    expect(yoursHint({ g: 290, balanceMm: 325 })).toBe('');
  });
});

describe('the beam', () => {
  test('tips to the heavier side, no further than 12 degrees, and lies level when nobody knows', () => {
    expect(beamPose(4, 330, 685.8)).toEqual({ tilt: -6, dot: 330 / 685.8 });
    expect(beamPose(-2, 350, 685.8).tilt).toBe(3);
    expect(beamPose(40, 100, 685.8).tilt).toBe(-12);
    expect(beamPose(-40, 600, 685.8).tilt).toBe(12);
    expect(beamPose(0, 342.9, 685.8)).toEqual({ tilt: 0, dot: 0.5 });
    expect(beamPose(null, null, 685.8)).toEqual({ tilt: 0, dot: null });
  });
  test('head light lowers the handle, which is drawn on the left', async () => {
    const f = await figuresFor(PUBLISHED, emptyBuild());
    expect(f.balance.points!).toBeGreaterThan(0);
    expect(beamPose(f.balance.points, f.balance.value, 685.8).tilt).toBeLessThan(0);
  });
});

describe('what is said', () => {
  const f: Figures = {
    weight: { value: 329.2, about: false, from: 'published', added: 24.2, change: 8.3 },
    balance: { value: 330.8, about: false, points: 3.82, change: 3.2, missing: 'Not published' },
    swingweight: { value: 321.6, change: 6.4 }, twist: 0.52, extras: { g: 8.3, centreMm: 512.4 },
  };
  test('the announcement', () => {
    expect(announcement(f)).toBe('Weight 329 grams, balance 331 millimetres, 4 points head light.');
    expect(announcement({ ...f, balance: { ...f.balance, points: -1.2 } })).toBe('Weight 329 grams, balance 331 millimetres, 1 point head heavy.');
    expect(announcement({ ...f, balance: { ...f.balance, points: 0.2, about: true } })).toBe('Weight 329 grams, balance about 331 millimetres, even.');
    expect(announcement({ ...f, weight: { ...f.weight, value: null, from: null }, balance: { ...f.balance, value: null, points: null, change: null } }))
      .toBe('Weight not published, 8.3 grams added. Balance not published.');
  });
  test('the cells', () => {
    const c = readoutCells(f);
    expect(c.weight).toEqual({ value: '329 g', change: '+8.3 g', against: 'vs stock strings', note: '305 g bare' });
    expect(c.balance).toEqual({ value: '331 mm', change: '+3.2 mm', against: 'vs stock strings', note: '4 pts head light' });
    expect(c.swingweight).toEqual({ value: 'about 322', change: '+6.4', against: 'vs stock strings', note: 'kg·cm²' });
    expect(c.twist).toEqual({ value: '+0.5', change: '', against: 'vs stock strings', note: 'kg·cm²' });
    const none = readoutCells({ ...f, weight: { ...f.weight, change: 0.01 }, balance: { ...f.balance, change: -0.02 } });
    expect(none.weight.change).toBe('no change');
    expect(none.balance.change).toBe('no change');
    expect(readoutCells({ ...f, weight: { ...f.weight, change: -2.04 } }).weight.change).toBe('−2.0 g');
  });
  test('tension in pounds and kilos', () => {
    expect(tensionText(52, 'lb')).toBe('52 lb');
    expect(tensionText(52.5, 'lb')).toBe('52.5 lb');
    expect(tensionText(52, 'kg')).toBe('23.6 kg');
  });
  test('what could not be read', () => {
    expect(droppedNotice([])).toBe('');
    expect(droppedNotice(['tension', 'overgrip'])).toBe('Some of this link could not be read: tension, overgrip. The rest is here.');
  });
  test('a typed measurement: whole numbers in range, or why not', () => {
    expect(cleanMeasure('g', '305')).toEqual({ value: 305 });
    expect(cleanMeasure('g', ' 304.6 ')).toEqual({ value: 305 });
    expect(cleanMeasure('g', '')).toEqual({ value: undefined });
    expect(cleanMeasure('g', '12')).toHaveProperty('error');
    expect(cleanMeasure('balanceMm', '32')).toHaveProperty('error');
    expect(cleanMeasure('balanceMm', 'abc')).toHaveProperty('error');
    expect(cleanMeasure('balanceMm', '320')).toEqual({ value: 320 });
  });
  test('every value that reads as clean survives the address', () => {
    for (const g of ['150', '420', '305']) {
      const { value } = cleanMeasure('g', g) as { value: number };
      expect(parseBuild(formatBuild(build({ yours: { g: value } })), strings).build.yours.g).toBe(value);
    }
  });
});

describe('tape', () => {
  test('a piece is named by the clock on the hoop and by its height on the sides', () => {
    expect(tapeName(piece('h', 0), 27)).toBe('12 o’clock');
    expect(tapeName(piece('h', 0, { mirrored: true }), 27)).toBe('12 o’clock');
    expect(tapeName(piece('h', 90), 27)).toBe('3 o’clock');
    expect(tapeName(piece('h', 90, { mirrored: true }), 27)).toBe('3 and 9 o’clock');
    expect(tapeName(piece('h', 60, { mirrored: true }), 27)).toBe('10 and 2 o’clock');
    expect(tapeName(piece('h', 300, { mirrored: true }), 27)).toBe('10 and 2 o’clock');
    expect(tapeName(piece('h', 75), 27)).toBe('2:30');
    expect(tapeName(piece('h', 359), 27)).toBe('11:58');
    expect(tapeName(piece('r', 90), 27)).toBe('Handle, right side, 90 mm up');
    expect(tapeName(piece('l', 250, { mirrored: true }), 27)).toBe('Throat, both sides, 250 mm up');
  });
  test('grams: a quarter gram an inch, by layers and sides', () => {
    expect(gramsOf(piece('h', 90, { lengthMm: 25.4 }))).toBeCloseTo(0.25, 9);
    expect(gramsOf(piece('h', 90, { lengthMm: 25.4, layers: 3, mirrored: true }))).toBeCloseTo(1.5, 9);
    expect(gramsOf(piece('h', 0, { lengthMm: 25.4, mirrored: true }))).toBeCloseTo(0.25, 9); // mirrors onto itself
  });
  test('a place and its mirror', () => {
    expect(mirrored({ zone: 'h', at: 60 })).toEqual({ zone: 'h', at: 300 });
    expect(mirrored({ zone: 'h', at: 0 })).toEqual({ zone: 'h', at: 0 });
    expect(mirrored({ zone: 'l', at: 90 })).toEqual({ zone: 'r', at: 90 });
  });
  test('the same place again is another layer, up to four; 24 pieces is the most', () => {
    let tape: TapePiece[] = [];
    let added = addPiece(tape, piece('h', 90, { mirrored: true }));
    expect(added).toMatchObject({ index: 0, result: 'added' });
    for (const layers of [2, 3, 4]) {
      added = addPiece(added.tape, piece('h', 90, { mirrored: true }));
      expect(added.result).toBe('layered');
      expect(added.tape).toHaveLength(1);
      expect(added.tape[0].layers).toBe(layers);
    }
    expect(addPiece(added.tape, piece('h', 90, { mirrored: true })).result).toBe('layers');
    expect(addPiece(added.tape, piece('h', 270, { mirrored: true })).result).toBe('layers'); // the same pair, named from the other side
    tape = Array.from({ length: 24 }, (_, i) => piece('h', i));
    const full = addPiece(tape, piece('h', 100));
    expect(full.result).toBe('full');
    expect(full.tape).toBe(tape);
  });
  test('a pointer settles on the hours, and is exact anywhere else', () => {
    expect(snapped({ zone: 'h', at: 92 })).toEqual({ zone: 'h', at: 90 });
    expect(snapped({ zone: 'h', at: 358 })).toEqual({ zone: 'h', at: 0 });
    expect(snapped({ zone: 'h', at: 47 })).toEqual({ zone: 'h', at: 47 });
    expect(snapped({ zone: 'r', at: 92 })).toEqual({ zone: 'r', at: 92 });
  });
  test('arrow keys walk the frame and never leave it', () => {
    const end = 330;
    expect(aimStep({ zone: 'h', at: 358 }, 'ArrowRight', false, end)).toEqual({ zone: 'h', at: 3 });
    expect(aimStep({ zone: 'h', at: 0 }, 'ArrowLeft', true, end)).toEqual({ zone: 'h', at: 359 });
    expect(aimStep({ zone: 'h', at: 100 }, 'ArrowDown', false, end)).toEqual({ zone: 'r', at: end });
    expect(aimStep({ zone: 'h', at: 200 }, 'ArrowDown', false, end)).toEqual({ zone: 'l', at: end });
    expect(aimStep({ zone: 'l', at: 3 }, 'ArrowDown', false, end)).toEqual({ zone: 'l', at: 0 });
    expect(aimStep({ zone: 'l', at: 200 }, 'ArrowRight', false, end)).toEqual({ zone: 'r', at: 200 });
    expect(aimStep({ zone: 'r', at: 200 }, 'ArrowUp', true, end)).toEqual({ zone: 'r', at: 201 });
    expect(aimStep({ zone: 'r', at: end }, 'ArrowUp', false, end)!.zone).toBe('h');
    expect(aimStep({ zone: 'h', at: 0 }, 'Enter', false, end)).toBeNull();
    let place: Pick<TapePiece, 'zone' | 'at'> = { zone: 'h', at: 0 };
    const seen = new Set<string>();
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    for (let i = 0; i < 5000; i++) {
      place = aimStep(place, keys[(i * 7919) % 11 % 4], i % 3 === 0, end)!;
      seen.add(place.zone);
      expect(place.at).toBeGreaterThanOrEqual(0);
      expect(place.at).toBeLessThanOrEqual(place.zone === 'h' ? 359 : end);
    }
    expect([...seen].sort()).toEqual(['h', 'l', 'r']);
  });
  test.each(['babolat-pure-drive-100', 'yonex-ezone-100', 'prince-o3-phantom-100x', 'prince-o3-legacy-120-2024', 'head-speed-junior-25', 'babolat-b-fly-19-2023', 'wilson-rf-01-pro'])('%s: every preset lies on the frame, and the arms end where the hoop begins', async (id) => {
    const { root, beds } = await model(id);
    const end = sideEnd((mm) => tapeAt(root, beds, new Vector3(0.02, mm / 1000, 0)).zone);
    expect(tapeAt(root, beds, new Vector3(0.02, end / 1000, 0)).zone).toBe('r');
    expect(tapeAt(root, beds, new Vector3(0.02, (end + 1) / 1000, 0)).zone).toBe('h');
    for (const { id: preset } of PRESETS) {
      const p = presetPiece(preset, end, specsOf(id).lengthIn);
      const laid = placeTape(root, beds, p);
      expect(laid).toHaveLength(preset === '12' ? 1 : 2);
      // What the address says is what was placed.
      expect(parseBuild(formatBuild(build({ tape: [p] })), strings).build.tape).toEqual([p]);
    }
  });
  test('the piece under the pointer is the nearest within reach, and knows its side', async () => {
    const { root, beds } = await model('babolat-pure-drive-100');
    const laid = [piece('h', 0), piece('h', 90, { mirrored: true }), piece('h', 140)].map((p) => placeTape(root, beds, p));
    expect(nearestPiece(laid, laid[0][0].centroid, 0.02)).toEqual({ index: 0, side: 0 });
    expect(nearestPiece(laid, laid[1][0].path[3], 0.012)).toEqual({ index: 1, side: 0 });
    expect(nearestPiece(laid, laid[1][1].path[3], 0.012)).toEqual({ index: 1, side: 1 });
    expect(nearestPiece(laid, new Vector3(0, 0.1, 0), 0.012)).toBeNull();
    expect(nearestPiece([[], []], new Vector3(), 1)).toBeNull();
  });
});

describe('the string bed', () => {
  test('a tap is on it inside the strings, and not on the hoop, the throat or the wall', async () => {
    const { beds } = await model('babolat-pure-drive-100');
    expect(onBed(beds, 0, 0.52)).toBe(true);
    expect(onBed(beds, 0.004, 0.5)).toBe(true); // between two mains
    expect(onBed(beds, 0.3, 0.52)).toBe(false);
    expect(onBed(beds, 0, 0.2)).toBe(false);
    expect(onBed(beds, 0.115, 0.66)).toBe(false); // the corner of its box is outside the hoop
    expect(onBed(beds, 0, 0.75)).toBe(false);
  });
});

describe('strings', () => {
  test('the list filters by material and by every word of the search, and always keeps the one chosen', () => {
    expect(stringList(strings, null, '', null)).toHaveLength(strings.length);
    const poly = stringList(strings, 'polyester', '', null);
    expect(poly.length).toBeGreaterThan(0);
    expect(poly.every((s) => s.material === 'polyester')).toBe(true);
    expect(stringList(strings, null, 'luxilon alu', null).map((s) => s.id)).toContain('luxilon-alu-power');
    expect(stringList(strings, null, 'alu luxilon', null).every((s) => s.brand === 'Luxilon')).toBe(true);
    expect(stringList(strings, null, 'zzz', null)).toEqual([]);
    expect(stringList(strings, 'multifilament', '', 'luxilon-alu-power')[0].id).toBe('luxilon-alu-power');
    const brands = stringList(strings, null, '', null).map((s) => s.brand);
    expect(brands).toEqual([...brands].sort((a, b) => a.localeCompare(b, 'en')));
  });
  test('chosen strings: crosses follow the mains unless given; stock, or no list, is null', () => {
    const mains = chooseString(named('luxilon-alu-power'));
    const set = chosenStrings(build({ mains }), strings)!;
    expect(set.mains.spec.id).toBe('luxilon-alu-power');
    expect(set.crosses).toEqual(set.mains);
    const hybrid = chosenStrings(build({ mains, crosses: chooseString(named('babolat-touch-vs')) }), strings)!;
    expect(hybrid.crosses.spec.id).toBe('babolat-touch-vs');
    expect(chosenStrings(emptyBuild(), strings)).toBeNull();
    expect(chosenStrings(build({ mains }), null)).toBeNull();
  });
});

describe('what is said about the ratings', () => {
  const known = { version: 'Evo Drive' as string | null, own: true };
  test('whose they are, above the rows', () => {
    expect(ratingsWord({ ...known, state: 'ready', has: true, stock: false }).head).toBe('Ratings for the Evo Drive');
    expect(ratingsWord({ ...known, version: null, state: 'ready', has: true, stock: false }).head).toBe('Ratings');
  });
  test('another version\u2019s are not passed off as this one\u2019s', () => {
    const w = ratingsWord({ version: 'Evo Drive', own: false, state: 'ready', has: true, stock: false });
    expect(w.head).toBe('Ratings for the Evo Drive');
    expect(w.notes).toEqual(['This version has no ratings of its own, so these are the Evo Drive’s.']);
  });
  test('stock strings are said to be unrated, but not while the list is still coming', () => {
    expect(ratingsWord({ ...known, state: 'ready', has: true, stock: true }).notes).toEqual(['Stock strings: not rated.']);
    expect(ratingsWord({ ...known, state: 'ready', has: true, stock: false }).notes).toEqual([]);
  });
  test('none, not here yet, and failed are three different things', () => {
    const none = ratingsWord({ ...known, state: 'ready', has: false, stock: false });
    expect(none).toEqual({ head: '', notes: ['This racquet has no ratings here yet, so this shows the change only.'], retry: false });
    expect(ratingsWord({ ...known, state: 'loading', has: false, stock: false })).toEqual({ head: '', notes: [], retry: false });
    expect(ratingsWord({ ...known, state: 'failed', has: false, stock: false })).toEqual({ head: '', notes: ['The ratings did not load, so this shows the change only.'], retry: true });
  });
});

describe('the estimate', () => {
  const racquet = { name: 'Pure Drive 100', ratings: { power: 4, spin: 4, control: 3, comfort: 3, stability: 3, maneuverability: 4, feel: 3 }, pattern: [16, 19] as [number, number], junior: false };
  const none = { swingweight: 0, twist: 0 };
  test('stock strings do not rate: at 52 lb nothing moves, and durability is left out', () => {
    const { rows, sentences } = playInput(racquet, emptyBuild(), null, none);
    expect(rows.map((r) => r.key)).toEqual(PLAY_KEYS.filter((k) => k !== 'durability'));
    for (const r of rows) expect(r.value).toBe(r.base);
    expect(sentences).toEqual(['Close to how the Pure Drive 100 plays as it comes.']);
  });
  test('stock strings: tension and weight still shift, and nothing is said about a material nobody knows', () => {
    const { rows, sentences } = playInput({ ...racquet, junior: true }, build({ tensionLb: 70 }), null, { swingweight: 12, twist: 0 });
    expect(rows.find((r) => r.key === 'power')!.shift).toBeLessThan(0);
    expect(rows.find((r) => r.key === 'stability')!.shift).toBeGreaterThan(0);
    expect(sentences.join(' ')).not.toMatch(/polyester/i);
    expect(rows.flatMap((r) => r.reasons.map((x) => x.text)).join(' ')).not.toMatch(/stock|gauge/i);
  });
  test('a racquet rated 5 is not said to gain there', () => {
    const b = build({ mains: chooseString(named('luxilon-alu-power')) });
    const { sentences, rows } = playInput({ ...racquet, ratings: { ...racquet.ratings, control: 5 } }, b, chosenStrings(b, strings), none);
    expect(rows.find((r) => r.key === 'control')!.shift).toBeGreaterThan(0.3);
    expect(sentences.join(' ')).not.toContain('gains most in control');
    expect(playInput(racquet, b, chosenStrings(b, strings), none).sentences.join(' ')).toContain('gains most in control');
  });
  test('chosen strings rate, with durability', () => {
    const b = build({ mains: chooseString(named('luxilon-alu-power')) });
    const { rows } = playInput(racquet, b, chosenStrings(b, strings), none);
    expect(rows).toHaveLength(PLAY_KEYS.length);
    expect(rows.find((r) => r.key === 'durability')!.base).toBe(named('luxilon-alu-power').ratings.durability);
  });
  test('crosses at their own tension', () => {
    const b = build({ mains: chooseString(named('luxilon-alu-power')), tensionLb: 52, crossTensionLb: 62 });
    const { rows } = playInput(racquet, b, chosenStrings(b, strings), none);
    expect(rows.find((r) => r.key === 'power')!.reasons.map((r) => r.text)).toContain('52 and 62 lb tension');
  });
  test('a rating already at the top does not go up, whatever the sum says', () => {
    const row = { key: 'power', base: 5, value: 5, shift: 0.6, reasons: [] } as const;
    expect(moveOf({ ...row, reasons: [] })).toBe(0);
    expect(moveOf({ ...row, base: null, value: null, reasons: [] })).toBe(0.6);
    expect(moved([{ ...row, reasons: [] }])).toBe('');
  });
  test('what moved most, for the line by the readout', () => {
    const { rows } = playInput(racquet, build({ tensionLb: 70 }), null, none);
    expect(moved(rows)).toBe('Power −0.8 · Comfort −0.8 · Control +0.6');
    expect(moved(playInput(racquet, emptyBuild(), null, none).rows)).toBe('');
  });
});
