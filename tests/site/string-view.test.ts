import { test, expect, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '../../src/catalog';
import { STRING_RATINGS, type StringMaterial, type StringSpec } from '../../src/string-spec';
import { searchRacquets } from '../../site/src/catalog-view';
import { MATERIAL_LABEL, RATING_KEYS, RATING_LABEL, colourOf, colourNote, firstGauge, resolveStrings, savedMaterial, searchAll, shownStrings, stringAisles, sectionNote, stringFacts, stringNeighbours, stringStepName, gaugeText, usualGauge } from '../../site/src/string-view';
import { forgetStrings, loadStrings } from '../../site/src/strings-data';

const catalog: Catalog = JSON.parse(readFileSync(join(__dirname, '../../assets/catalog.json'), 'utf8'));

function str(brand: string, name: string, material: StringMaterial, hexes: string[], shape: StringSpec['shape'] = { sides: 0, label: 'Round' }): StringSpec {
  return {
    id: `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), brand, name, material, shape, gaugesMm: [1.2, 1.25],
    colours: hexes.map((hex, i) => ({ id: `c${i}`, name: ['Silver', 'Red', 'Natural'][i] ?? `Colour ${i}`, hex })),
    finish: 'satin', summary: '', bestFor: ['spin'], ratings: { power: 3, spin: 3, control: 3, comfort: 3, feel: 3, durability: 3 },
    compared: [], confidence: 'high', sources: ['https://example.com'], researchedOn: '2026-11-24', verified: false,
  };
}
const strings: StringSpec[] = [
  str('Luxilon', 'ALU Power', 'polyester', ['#9a9da0']),
  str('Luxilon', 'Original', 'natural-gut', ['#e8d8b0', '#c33'], null),
  str('Babolat', 'RPM Blast', 'polyester', ['#222222', '#9a9da0'], { sides: 5, label: 'Pentagon' }),
  str('Babolat', 'Xcel', 'multifilament', ['#9a9da0']),
  str('Babolat', 'VS Touch', 'natural-gut', ['#e8d8b0']),
  str('Wilson', 'Sensation', 'synthetic-gut', ['#e8d8b0']),
];

test('aisles filter by material and drop empty brands', () => {
  expect(stringAisles(strings, null).map((a) => a.brand)).toEqual(['Babolat', 'Luxilon', 'Wilson']);
  const poly = stringAisles(strings, 'polyester');
  expect(poly.map((a) => a.brand)).toEqual(['Babolat', 'Luxilon']);
  expect(poly[0].strings.map((s) => s.name)).toEqual(['RPM Blast']);
  expect(stringAisles(strings, 'multifilament').map((a) => a.brand)).toEqual(['Babolat']);
  expect(MATERIAL_LABEL['synthetic-gut']).toBe('Synthetic gut');
});

test('the fan puts distinct default colours first, at most five', () => {
  const many = ['Z', 'Y', 'X', 'W', 'V', 'U'].map((n) => str('B', n, 'polyester', ['#111111']));
  const odd = str('B', 'Odd', 'polyester', ['#abcdef']);
  const [aisle] = stringAisles([...many, odd], null);
  expect(aisle.fan).toHaveLength(5);
  expect(aisle.fan.slice(0, 2).map((s) => s.name)).toEqual(['Odd', 'U']);
  expect(aisle.colours).toBe(7);
});

test('neighbours run across brands and wrap over the whole aisle order', () => {
  const order = stringAisles(strings, null).flatMap((x) => x.strings);
  const first = order[0];
  const last = order[order.length - 1];
  const babolatLast = order.filter((s) => s.brand === 'Babolat').pop()!;
  const luxilonFirst = order.find((s) => s.brand === 'Luxilon')!;
  expect(stringNeighbours(strings, babolatLast).next).toBe(luxilonFirst);
  expect(stringNeighbours(strings, luxilonFirst).prev).toBe(babolatLast);
  expect(stringNeighbours(strings, last).next).toBe(first);
  expect(stringNeighbours(strings, first).prev).toBe(last);
  const wilson = strings.find((s) => s.brand === 'Wilson')!; // single-string brand, last
  const lux = order.filter((s) => s.brand === 'Luxilon').pop()!;
  expect(stringNeighbours(strings, wilson)).toEqual({ prev: lux, next: first });
  expect(stringNeighbours([wilson], wilson)).toEqual({ prev: wilson, next: wilson });
});

test('facts say Not stated for a null shape', () => {
  expect(stringFacts(strings[1])).toEqual([
    { label: 'Material', value: 'Natural gut' },
    { label: 'Shape', value: 'Not stated' },
    { label: 'Gauges', value: '1.20\u00a0(~17), 1.25\u00a0(~17) mm' },
    { label: 'Colours', value: '2' },
  ]);
  expect(stringFacts(strings[0])[1].value).toBe('Round');
});

test('a string is drawn at 1.25 mm first where it is sold, else at its thinnest', () => {
  expect(firstGauge(strings[0])).toBe(1.25);
  expect(firstGauge({ ...strings[0], gaugesMm: [1.18, 1.24, 1.3] })).toBe(1.18);
});

test('the section is described in words: shape, then twisted and rough', () => {
  expect(sectionNote(null)).toBe('Shape not stated');
  expect(sectionNote({ sides: 0, label: 'Round' })).toBe('Round');
  expect(sectionNote({ sides: 6, label: 'Hexagonal', twisted: true })).toBe('Hexagonal, twisted along its length');
  expect(sectionNote({ sides: 0, label: 'Round', rough: true })).toBe('Round, with a rough surface');
  expect(sectionNote({ sides: 5, label: 'Pentagonal', twisted: true, rough: true })).toBe('Pentagonal, twisted along its length, with a rough surface');
  expect(sectionNote({ sides: 0, label: 'Rough', rough: true })).toBe('Rough');
});

test('a step names the brand only when it leaves it', () => {
  expect(stringStepName(strings[0], 'Luxilon')).toBe('ALU Power');
  expect(stringStepName(strings[0], 'Babolat')).toBe('Luxilon ALU Power');
});

test('the page rates what the data rates, in the same order', () => {
  expect(RATING_KEYS).toEqual([...STRING_RATINGS]);
  for (const k of RATING_KEYS) expect(RATING_LABEL[k].toLowerCase()).toBe(k);
});

test('a strings address finds its string, colour or floor', () => {
  expect(resolveStrings({ kind: 'strings' }, strings)).toEqual({ string: null, brand: null, notice: '' });
  expect(resolveStrings({ kind: 'string-brand', slug: 'luxilon' }, strings)).toEqual({ string: null, brand: 'Luxilon', notice: '' });
  expect(resolveStrings({ kind: 'string', id: 'luxilon-original', colour: 'c1' }, strings)).toEqual({ string: strings[1], colour: strings[1].colours[1], notice: '' });
});

test('an unknown string or brand is the strings floor with a notice', () => {
  expect(resolveStrings({ kind: 'string', id: 'no-such-string', colour: null }, strings)).toEqual({ string: null, brand: null, notice: 'There is no string with the id “no-such-string”. Here are the brands.' });
  expect(resolveStrings({ kind: 'string-brand', slug: 'nope' }, strings)).toEqual({ string: null, brand: null, notice: 'There is no string brand “nope”. Here are the brands.' });
});

test('an unknown colour is the first, without a notice', () => {
  expect(resolveStrings({ kind: 'string', id: 'luxilon-original', colour: 'puce' }, strings)).toEqual({ string: strings[1], colour: strings[1].colours[0], notice: '' });
});

test('a brand the filter hides is still a floor, with nothing on it', () => {
  expect(resolveStrings({ kind: 'string-brand', slug: 'wilson' }, strings)).toMatchObject({ brand: 'Wilson', notice: '' });
  expect(stringAisles(strings, 'polyester').some((a) => a.brand === 'Wilson')).toBe(false);
  expect(shownStrings(strings, 'polyester', 'Wilson')).toBe('Showing no polyester Wilson strings.');
});

test('what is shown is announced as the racquets are', () => {
  expect(shownStrings(strings, null, null)).toBe('Showing all 6 strings.');
  expect(shownStrings(strings, 'polyester', null)).toBe('Showing all 2 polyester strings.');
  expect(shownStrings(strings, null, 'Luxilon')).toBe('Showing 2 Luxilon strings.');
  expect(shownStrings(strings, 'natural-gut', 'Babolat')).toBe('Showing 1 natural gut Babolat string.');
  expect(shownStrings(strings, 'multifilament', null)).toBe('Showing 1 multifilament string.');
});

test('only a real material is taken from storage', () => {
  expect(savedMaterial('natural-gut')).toBe('natural-gut');
  for (const v of [null, '', 'all', 'kevlar', 'toString']) expect(savedMaterial(v)).toBeNull();
});

test('colours nobody checked against a photo say so', () => {
  expect(colourNote({ ...strings[0], verified: false })).toBe('Colours approximate: not checked against a photo.');
  expect(colourNote({ ...strings[0], verified: true })).toBeNull();
});

test('colourOf falls back to the first colour', () => {
  expect(colourOf(strings[1], 'c1').hex).toBe('#c33');
  expect(colourOf(strings[1], 'nope')).toBe(strings[1].colours[0]);
  expect(colourOf(strings[1], null)).toBe(strings[1].colours[0]);
});

test('a brand or shape word finds strings; a model word still finds racquets first', () => {
  const real: StringSpec[] = JSON.parse(readFileSync(join(__dirname, '../../assets/strings.json'), 'utf8')).strings;
  expect(searchAll(catalog, real, 'alu power')[0]).toMatchObject({ kind: 'string', id: 'luxilon-alu-power' });
  expect(searchAll(catalog, strings, 'blade 98')[0].kind).toBe('racquet');
  expect(searchAll(catalog, strings, 'babolat').map((h) => h.kind)).toContain('string');
  expect(searchAll(catalog, strings, 'pentagon')[0]).toMatchObject({ kind: 'string', name: 'RPM Blast' });
  expect(searchAll(catalog, strings, 'natural gut').map((h) => h.kind === 'string' && h.name)).toEqual(['VS Touch', 'Original']);
  expect(searchAll(catalog, strings, 'red')).toContainEqual(expect.objectContaining({ kind: 'string', name: 'Original' }));
});

test('strings get their share of a crowded result, racquets keep their order', () => {
  const many = Array.from({ length: 20 }, (_, i) => str('Babolat', `String ${String.fromCharCode(65 + i)}`, 'polyester', ['#111111']));
  const racquetsOnly = searchRacquets(catalog, 'babolat', 40);
  expect(racquetsOnly.length).toBe(40); // the catalog crowds a 40-place list
  const hits = searchAll(catalog, many, 'babolat');
  expect(hits).toHaveLength(40);
  expect(hits.filter((h) => h.kind === 'string')).toHaveLength(8);
  const rs = hits.flatMap((h) => (h.kind === 'racquet' ? [h.hit] : []));
  expect(rs).toEqual(racquetsOnly.slice(0, 32));
  // Another limit: ceil(limit / 5), capped at the matching strings.
  expect(searchAll(catalog, many, 'babolat', 10).filter((h) => h.kind === 'string')).toHaveLength(2);
  expect(searchAll(catalog, many.slice(0, 3), 'babolat').filter((h) => h.kind === 'string')).toHaveLength(3);
});

test('without strings, search is exactly searchRacquets', () => {
  const expected = searchRacquets(catalog, 'pure aero');
  expect(searchAll(catalog, null, 'pure aero').map((h) => h.kind === 'racquet' && h.hit)).toEqual(expected);
  expect(searchAll(catalog, [], 'pure aero').map((h) => h.kind === 'racquet' && h.hit)).toEqual(expected);
});

test('empty and punctuation-only queries find nothing', () => {
  for (const q of ['', '   ', '--', '!?']) expect(searchAll(catalog, strings, q)).toEqual([]);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  forgetStrings();
});

test('loadStrings loads once, and a failed load is retried', async () => {
  let calls = 0;
  const payload = { version: 1, spool: {}, strings: [] };
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1 ? new Response('no', { status: 500 }) : calls === 2 ? new Response(JSON.stringify({ strings: 'x' })) : new Response(JSON.stringify(payload));
  }) as unknown as typeof fetch;
  await expect(loadStrings()).rejects.toThrow('500');
  await expect(loadStrings()).rejects.toThrow('expected format');
  const ok = await loadStrings();
  expect(ok.strings).toEqual([]);
  expect(await loadStrings()).toBe(ok);
  expect(calls).toBe(3);
});

test('loadStrings retries after a network error and after invalid JSON', async () => {
  const payload = JSON.stringify({ version: 1, spool: {}, strings: [] });
  for (const bad of [() => Promise.reject(new TypeError('offline')), () => Promise.resolve(new Response('<html>'))]) {
    let calls = 0;
    globalThis.fetch = (async () => (++calls === 1 ? bad() : new Response(payload))) as unknown as typeof fetch;
    await expect(loadStrings()).rejects.toThrow();
    expect((await loadStrings()).strings).toEqual([]);
    expect(calls).toBe(2);
    forgetStrings();
  }
});

test('a gauge shows its number beside its mm: its own, or the usual one marked ~', () => {
  expect(gaugeText({ gaugeNames: { '1.25': '16L' } }, 1.25)).toBe('1.25 · 16L');
  expect(gaugeText({}, 1.25)).toBe('1.25 · ~17');
  expect([1.38, 1.3, 1.2, 1.15, 1.1, 1.05].map(usualGauge)).toEqual(['15L', '16', '17', '18', '19', '20']);
});
