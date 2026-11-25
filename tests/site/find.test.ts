import { test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, StringCatalog } from '../../src/catalog';
import type { Profile } from '../../site/src/profiles';
import {
  NO_RACQUET_FIND, NO_STRING_FIND, findRacquets, findStrings, formatRacquetFind, formatStringFind,
  isEmptyFind, parseRacquetFind, parseStringFind,
} from '../../site/src/find';

const root = join(__dirname, '../..');
const catalog: Catalog = JSON.parse(readFileSync(join(root, 'assets/catalog.json'), 'utf8'));
const strings = (JSON.parse(readFileSync(join(root, 'assets/strings.json'), 'utf8')) as StringCatalog).strings;
const profiles = new Map(
  readdirSync(join(root, 'profiles')).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(root, 'profiles', f), 'utf8')) as Profile[]).map((p) => [p.id, p] as const),
);

test('a racquet filter survives its address; junk is dropped', () => {
  const f = { play: ['spin', 'control'], level: 'advanced', head: 'mid', weight: 'light', pattern: '16x19' } as const;
  const q = formatRacquetFind({ ...f, play: [...f.play] });
  expect(q).toBe('play=spin,control&level=advanced&head=mid&weight=light&pattern=16x19');
  expect(parseRacquetFind(q)).toEqual({ ...f, play: [...f.play] });
  expect(parseRacquetFind('play=nope,spin,spin&level=pro&head=&pattern=x')).toEqual({ ...NO_RACQUET_FIND, play: ['spin'] });
  expect(isEmptyFind(parseRacquetFind(''))).toBe(true);
  expect(isEmptyFind(parseRacquetFind('head=mid'))).toBe(false);
});

test('a string filter survives its address', () => {
  const q = 'play=durability&gauge=thin&shape=shaped&value=1';
  expect(formatStringFind(parseStringFind(q))).toBe(q);
  expect(isEmptyFind(NO_STRING_FIND)).toBe(true);
  expect(isEmptyFind(parseStringFind('value=1'))).toBe(false);
});

test('a play filter keeps only lines rated 4 or more, best first, one per line', () => {
  const found = findRacquets(catalog, profiles, parseRacquetFind('play=spin'), 'adult');
  expect(found.hits.length).toBeGreaterThan(5);
  expect(found.hits.every((h) => h.ratings!.spin >= 4)).toBe(true);
  const scores = found.hits.map((h) => h.ratings!.spin);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  expect(new Set(found.hits.map((h) => h.family.lineage)).size).toBe(found.hits.length);
  expect(found.unrated).toBeGreaterThan(0);
});

test('specs are matched size by size, and only the matching sizes are named', () => {
  const found = findRacquets(catalog, profiles, parseRacquetFind('head=small&weight=heavy'), 'adult');
  expect(found.hits.length).toBeGreaterThan(0);
  for (const h of found.hits) {
    expect(h.matching.length).toBeGreaterThan(0);
    expect(h.matching.every((r) => r.specs.headSizeSqIn <= 98 && r.specs.unstrungWeightG! >= 305)).toBe(true);
    expect(h.matching.length).toBeLessThanOrEqual(h.sizes);
  }
  expect(found.noWeight).toBeGreaterThan(0);
  expect(found.unrated).toBe(0);
});

test('a junior frame never borrows the adult ratings', () => {
  const found = findRacquets(catalog, profiles, parseRacquetFind('play=spin'), 'junior');
  expect(found.hits).toEqual([]);
  expect(findRacquets(catalog, profiles, parseRacquetFind('pattern=16x19'), 'junior').hits.every((h) => h.matching.every((r) => r.specs.lengthIn < 27))).toBe(true);
});

test('level comes from the profile', () => {
  const found = findRacquets(catalog, profiles, parseRacquetFind('level=beginner'), 'adult');
  expect(found.hits.length).toBeGreaterThan(0);
  expect(found.hits.every((h) => profiles.get(h.family.id)!.playerLevel.includes('beginner'))).toBe(true);
});

test('strings: ratings, material, gauge, shape and value', () => {
  const spin = findStrings(strings, parseStringFind('play=spin,control'), 'polyester');
  expect(spin.hits.length).toBeGreaterThan(0);
  expect(spin.hits.every((s) => s.material === 'polyester' && s.ratings.spin >= 4 && s.ratings.control >= 4)).toBe(true);
  const sum = spin.hits.map((s) => s.ratings.spin + s.ratings.control);
  expect(sum).toEqual([...sum].sort((a, b) => b - a));
  expect(findStrings(strings, parseStringFind('gauge=thin'), null).hits.every((s) => s.gaugesMm.some((g) => g <= 1.2))).toBe(true);
  const shaped = findStrings(strings, parseStringFind('shape=shaped'), null);
  expect(shaped.hits.every((s) => s.shape && (s.shape.sides >= 3 || s.shape.twisted))).toBe(true);
  expect(shaped.noShape).toBe(strings.filter((s) => !s.shape).length);
  expect(findStrings(strings, parseStringFind('value=1'), null).hits.every((s) => s.bestFor.includes('value'))).toBe(true);
});

test('a line counts as left out for missing facts only when none of its generations has them', () => {
  const lines = new Map<string, Catalog['racquets']>();
  for (const r of catalog.racquets) lines.set(r.lineage, [...(lines.get(r.lineage) ?? []), r]);
  const unratedLines = [...lines.values()].filter((rs) => !rs.some((r) => profiles.has(r.id))).length;
  expect(findRacquets(catalog, profiles, parseRacquetFind('play=spin,control'), 'adult').unrated).toBeLessThanOrEqual(unratedLines);
  const weightless = [...lines.values()].filter((rs) => !rs.some((r) => r.specs.unstrungWeightG !== undefined)).length;
  expect(findRacquets(catalog, profiles, parseRacquetFind('weight=heavy'), 'all').noWeight).toBeLessThanOrEqual(weightless);
});
