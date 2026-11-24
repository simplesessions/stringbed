import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '../../src/catalog';
import {
  DEFAULT_STYLE,
  assetFor,
  assetUrl,
  fileNameFromPath,
  filterByBrand,
  formatBeam,
  formatBytes,
  formatHeadSize,
  formatLength,
  formatPattern,
  generationLabel,
  groupByBrand,
  parseRoute,
  pickStyle,
  routeFor,
  groupPlaceholders,
  placeholderLabel,
  searchRacquets,
  wallName,
  wallGroups,
  olderCount,
  isJunior,
  isOlderGeneration,
  generationsOf,
  aislesOf,
  shelvesOf,
  membersOf,
  brandRoute,
  parseBrandRoute,
  parseShelfRoute,
} from '../../site/src/catalog-view';

const catalog: Catalog = JSON.parse(readFileSync(join(__dirname, '../../assets/catalog.json'), 'utf8'));

test('assetUrl respects the base path', () => {
  expect(assetUrl('/stringbed/', 'realistic/x.glb')).toBe('/stringbed/realistic/x.glb');
  expect(assetUrl('/', 'realistic/x.glb')).toBe('/realistic/x.glb');
});

test('assetUrl tolerates a base without a trailing slash and a path with a leading one', () => {
  expect(assetUrl('/stringbed', '/realistic/x.glb')).toBe('/stringbed/realistic/x.glb');
  expect(assetUrl('./', 'catalog.json')).toBe('./catalog.json');
});

test('parseRoute', () => {
  expect(parseRoute('#/wilson-blade-98-v10')).toEqual({ racquetId: 'wilson-blade-98-v10', colourway: null });
  expect(parseRoute('')).toEqual({ racquetId: null, colourway: null });
  expect(parseRoute('#/yonex-ezone-100/espresso-brown')).toEqual({ racquetId: 'yonex-ezone-100', colourway: 'espresso-brown' });
  expect(routeFor('yonex-ezone-100', 'espresso-brown')).toBe('#/yonex-ezone-100/espresso-brown');
});

test('parseRoute ignores hashes that are not racquet routes', () => {
  expect(parseRoute('#')).toEqual({ racquetId: null, colourway: null });
  expect(parseRoute('#/')).toEqual({ racquetId: null, colourway: null });
  expect(parseRoute('#main')).toEqual({ racquetId: null, colourway: null });
  expect(parseRoute('#/wilson-blade-98-v10/')).toEqual({ racquetId: 'wilson-blade-98-v10', colourway: null });
  expect(parseRoute('#/Not%20An%20Id')).toEqual({ racquetId: null, colourway: null });
});

test('routeFor round-trips through parseRoute', () => {
  expect(routeFor('yonex-ezone-100')).toBe('#/yonex-ezone-100');
  expect(parseRoute(routeFor('yonex-ezone-100'))).toEqual({ racquetId: 'yonex-ezone-100', colourway: null });
  expect(routeFor(null)).toBe('#/');
});

test('groupByBrand sorts brands', () => {
  expect(groupByBrand(catalog).map((g) => g.brand)).toEqual(['Babolat', 'Dunlop', 'Head', 'Prince', 'Solinco', 'Tecnifibre', 'Wilson', 'Yonex']);
});

test('groupByBrand keeps every family once (variants left out) and sorts within a brand', () => {
  const groups = groupByBrand(catalog);
  const ids = groups.flatMap((g) => g.racquets.map((r) => r.id));
  expect(ids.sort()).toEqual(catalog.racquets.filter((r) => !r.variantOf).map((r) => r.id).sort());
  for (const g of groups) {
    expect(g.racquets.every((r) => r.brand === g.brand)).toBe(true);
    const models = g.racquets.map((r) => wallName(r));
    expect(models).toEqual([...models].sort((a, b) => a.localeCompare(b)));
  }
});

test('filterByBrand keeps one brand, or all of them for null', () => {
  const groups = groupByBrand(catalog);
  expect(filterByBrand(groups, null)).toBe(groups);
  expect(filterByBrand(groups, 'Wilson').map((g) => g.brand)).toEqual(['Wilson']);
  expect(filterByBrand(groups, 'Nobody')).toEqual([]);
});

test('pickStyle prefers the default style, then the first listed', () => {
  expect(DEFAULT_STYLE).toBe('realistic');
  expect(pickStyle(catalog, null)?.id).toBe(DEFAULT_STYLE);
  const other: Catalog = {
    ...catalog,
    styles: [
      { id: 'toon', kind: '3d', label: 'Toon', extension: 'glb' },
      { id: 'pixel', kind: '2d', label: 'Pixel', extension: 'png' },
    ],
  };
  expect(pickStyle(other, null)?.id).toBe('toon');
  expect(pickStyle(other, 'pixel')?.id).toBe('pixel');
  expect(pickStyle(other, 'missing')?.id).toBe('toon');
  expect(pickStyle({ ...catalog, styles: [] }, null)).toBeNull();
});

test('assetFor returns the racquet asset for a style, or null', () => {
  const r = catalog.racquets[0];
  expect(assetFor(r, DEFAULT_STYLE)?.path).toBe(r.assets[DEFAULT_STYLE].path);
  expect(assetFor(r, 'missing')).toBeNull();
});

test('fileNameFromPath takes the last path segment', () => {
  expect(fileNameFromPath('realistic/babolat-pure-aero-100.glb')).toBe('babolat-pure-aero-100.glb');
  expect(fileNameFromPath('x.glb')).toBe('x.glb');
});

test('formatBytes uses decimal kilobytes', () => {
  expect(formatBytes(116616)).toBe('117 kB');
  expect(formatBytes(999)).toBe('999 B');
  expect(formatBytes(1_500_000)).toBe('1.5 MB');
});

test('formatPattern uses a multiplication sign', () => {
  expect(formatPattern([16, 19])).toBe('16 × 19');
});

test('generationLabel shows the year once when the generation is the year', () => {
  const r = catalog.racquets.find((x) => x.id === 'babolat-pure-aero-100')!;
  expect(generationLabel(r)).toBe('2026');
  expect(generationLabel({ ...r, generation: 'Gen 11', year: 2025 })).toBe('Gen 11, 2025');
});

test('formatHeadSize and formatLength give imperial then metric', () => {
  expect(formatHeadSize(100)).toEqual({ primary: '100 in²', secondary: '645 cm²' });
  expect(formatLength(27)).toEqual({ primary: '27 in', secondary: '68.6 cm' });
});

test('formatBeam collapses a constant beam', () => {
  expect(formatBeam([23, 26, 23])).toBe('23 / 26 / 23 mm');
  expect(formatBeam([21.7, 21.7, 21.7])).toBe('21.7 mm');
});

test('placeholders group by brand, newest sale year first', () => {
  const groups = groupPlaceholders(catalog);
  expect(groups.map((g) => g.brand)).toEqual(['Babolat', 'Head', 'Prince', 'Solinco', 'Tecnifibre', 'Wilson', 'Yonex']);
  expect(groups.reduce((n, g) => n + g.count, 0)).toBe(catalog.placeholders.length);
  const babolat = groups.find((g) => g.brand === 'Babolat')!;
  expect(babolat.years.map((y) => y.year)).toEqual([2026, 2023]);
});
test('placeholderLabel', () => {
  expect(placeholderLabel({ generation: 'Gen9', releaseYear: 2026 })).toBe('Gen9, 2026');
  expect(placeholderLabel({ generation: '2023', releaseYear: 2022 })).toBe('2023 (released 2022)');
  expect(placeholderLabel({ generation: '2025', releaseYear: 2025 })).toBe('2025');
  expect(placeholderLabel({ generation: null, releaseYear: null })).toBe('');
});

test('searchRacquets matches word prefixes across brand, model and year', () => {
  expect(searchRacquets(catalog, '')).toEqual([]);
  const aero = searchRacquets(catalog, 'pure aero');
  expect(aero[0]).toMatchObject({ id: 'babolat-pure-aero-100', hasModel: true });
  // the search also matches a frame's line, so a junior named for another product (Carlitos) can follow
  expect(aero.slice(0, 5).every((h) => h.model.toLowerCase().includes('aero'))).toBe(true);
  expect(searchRacquets(catalog, 'head speed').every((h) => h.brand === 'Head')).toBe(true);
  expect(searchRacquets(catalog, 'babolat 2023').length).toBeGreaterThan(0);
  expect(searchRacquets(catalog, 'zzzz')).toEqual([]);
});

test('groupPlaceholders filters by size', () => {
  const total = (age: 'adult' | 'junior' | 'all') => groupPlaceholders(catalog, age).reduce((n, g) => n + g.count, 0);
  expect(total('adult') + total('junior')).toBe(total('all'));
  expect(total('junior')).toBeGreaterThan(0);
  for (const g of groupPlaceholders(catalog, 'junior')) for (const y of g.years) for (const p of y.items) expect(p.category).toBe('junior');
});

test('wallGroups: latest generation by default, juniors only in Junior', () => {
  const count = (age: 'adult' | 'junior' | 'all', older: boolean) => wallGroups(catalog, age, older).reduce((n, g) => n + g.racquets.length, 0);
  expect(count('adult', true)).toBeGreaterThan(count('adult', false));
  expect(olderCount(catalog, 'adult')).toBe(count('adult', true) - count('adult', false));
  for (const g of wallGroups(catalog, 'adult', false)) for (const r of g.racquets) {
    expect(r.variantOf).toBeUndefined();
    expect(isJunior(r)).toBe(false);
    expect(isOlderGeneration(catalog, r)).toBe(false);
  }
  const juniors = wallGroups(catalog, 'junior', true).flatMap((g) => g.racquets);
  expect(juniors.length).toBeGreaterThan(0);
  expect(juniors.every(isJunior)).toBe(true);
  const aero = catalog.racquets.find((r) => r.id === 'babolat-pure-aero-100')!;
  const gens = generationsOf(catalog, aero);
  expect(gens[0].id).toBe('babolat-pure-aero-100');
  expect(gens.length).toBeGreaterThanOrEqual(3);
  expect(gens.every((g) => g.lineage === 'babolat-pure-aero')).toBe(true);
});

test('shop floor: aisles, shelves and members', () => {
  const aisles = aislesOf(catalog, 'adult');
  expect(aisles.map((x) => x.brand)).toContain('Babolat');
  for (const a of aisles) {
    expect(a.fan.length).toBeGreaterThan(0);
    expect(a.fan.length).toBeLessThanOrEqual(5);
    expect(a.fan.every((r) => r.brand === a.brand && !isJunior(r))).toBe(true);
  }
  const shelves = shelvesOf(catalog, 'Babolat', 'adult');
  const aero = shelves.find((s) => s.lineage === 'babolat-pure-aero')!;
  expect(aero.name).toBe('Pure Aero');
  expect(aero.generations[0].id).toBe('babolat-pure-aero-100');
  expect(membersOf(catalog, aero.generations[0], 'adult').every((r) => !isJunior(r))).toBe(true);
  expect(membersOf(catalog, aero.generations[0], 'junior').every(isJunior)).toBe(true);
  expect(shelves.find((s) => s.lineage === 'babolat-pure-aero-rafa')?.name).toBe('Pure Aero Rafa');
  expect(parseBrandRoute(brandRoute('Babolat'), ['Babolat', 'Head'])).toBe('Babolat');
  expect(parseBrandRoute('#/babolat-pure-aero-100', ['Babolat'])).toBeNull();
});

test('brand routes can point at a line', () => {
  expect(brandRoute('Babolat', 'babolat-pure-aero')).toBe('#/b/babolat/babolat-pure-aero');
  expect(parseBrandRoute('#/b/babolat/babolat-pure-aero', ['Babolat'])).toBe('Babolat');
  expect(parseShelfRoute('#/b/babolat/babolat-pure-aero')).toBe('babolat-pure-aero');
  expect(parseShelfRoute('#/b/babolat')).toBeNull();
});

test('groupPlaceholders gathers variants by product line', () => {
  for (const g of groupPlaceholders(catalog)) {
    expect(g.families.reduce((t, f) => t + f.variants.length, 0)).toBe(g.count);
    expect(new Set(g.families.map((f) => f.line)).size).toBe(g.families.length);
  }
});
