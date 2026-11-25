import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, StringCatalog } from '../../src/catalog';
import { parseHash, routeFor, brandRoute, brandSlug, stringsRoute, stringRoute, buildRoute, type Route, findRoute, stringFindRoute } from '../../site/src/routes';
import { brandNamed } from '../../site/src/catalog-view';

const asset = (name: string) => JSON.parse(readFileSync(join(__dirname, '../../assets', name), 'utf8'));
const catalog: Catalog = asset('catalog.json');
const { strings }: StringCatalog = asset('strings.json');

test.each([
  ['', { kind: 'home' }], ['#', { kind: 'home' }], ['#/', { kind: 'home' }], ['#/???', { kind: 'home' }], ['#main', { kind: 'home' }],
  ['#/Not%20An%20Id', { kind: 'home' }],
  ['#/b/wilson', { kind: 'brand', slug: 'wilson', lineage: null }],
  ['#/b/wilson/', { kind: 'brand', slug: 'wilson', lineage: null }],
  ['#/b/wilson/wilson-blade', { kind: 'brand', slug: 'wilson', lineage: 'wilson-blade' }],
  ['#/wilson-blade-98-v10', { kind: 'racquet', id: 'wilson-blade-98-v10', colourway: null }],
  ['#/wilson-blade-98-v10/', { kind: 'racquet', id: 'wilson-blade-98-v10', colourway: null }],
  ['#/yonex-ezone-100/espresso-brown/', { kind: 'racquet', id: 'yonex-ezone-100', colourway: 'espresso-brown' }],
  ['#/strings', { kind: 'strings' }], ['#/strings/b', { kind: 'strings' }],
  ['#/strings/b/signum-pro', { kind: 'string-brand', slug: 'signum-pro' }],
  ['#/strings/luxilon-alu-power', { kind: 'string', id: 'luxilon-alu-power', colour: null }],
  ['#/strings/luxilon-alu-power/silver', { kind: 'string', id: 'luxilon-alu-power', colour: 'silver' }],
  ['#/build/wilson-blade-98-v10?v=1&t=52', { kind: 'build', id: 'wilson-blade-98-v10', colourway: null, query: 'v=1&t=52' }],
  ['#/build/yonex-ezone-100/espresso-brown', { kind: 'build', id: 'yonex-ezone-100', colourway: 'espresso-brown', query: '' }],
  ['#/build/yonex-ezone-100/espresso-brown?v=2', { kind: 'build', id: 'yonex-ezone-100', colourway: 'espresso-brown', query: 'v=2' }],
  ['#/build', { kind: 'home' }], ['#/build?x', { kind: 'home' }], ['#/strings/b/x/y', { kind: 'home' }],
  ['#/building-x', { kind: 'racquet', id: 'building-x', colourway: null }],
  ['#/builder-x/red', { kind: 'racquet', id: 'builder-x', colourway: 'red' }],
  ['#/stringsy-x', { kind: 'racquet', id: 'stringsy-x', colourway: null }],
])('%s', (hash, route) => expect(parseHash(hash)).toEqual(route as Route));

test('builders produce the documented hashes', () => {
  expect(routeFor(null)).toBe('#/');
  expect(routeFor('yonex-ezone-100')).toBe('#/yonex-ezone-100');
  expect(routeFor('yonex-ezone-100', 'espresso-brown')).toBe('#/yonex-ezone-100/espresso-brown');
  expect(brandRoute('Babolat', 'babolat-pure-aero')).toBe('#/b/babolat/babolat-pure-aero');
  expect(brandRoute('Babolat')).toBe('#/b/babolat');
  expect(stringsRoute()).toBe('#/strings');
  expect(stringsRoute('luxilon')).toBe('#/strings/b/luxilon');
  expect(stringRoute('luxilon-alu-power')).toBe('#/strings/luxilon-alu-power');
  expect(stringRoute('luxilon-alu-power', 'silver')).toBe('#/strings/luxilon-alu-power/silver');
  expect(buildRoute('a-b')).toBe('#/build/a-b');
  expect(buildRoute('a-b', 'red', 'v=1')).toBe('#/build/a-b/red?v=1');
  expect(buildRoute('a-b', null, 'v=1')).toBe('#/build/a-b?v=1');
});

test('builders and parser agree for every racquet, colourway, brand and string', () => {
  for (const r of catalog.racquets) {
    expect(parseHash(routeFor(r.id))).toEqual({ kind: 'racquet', id: r.id, colourway: null });
    expect(parseHash(buildRoute(r.id))).toEqual({ kind: 'build', id: r.id, colourway: null, query: '' });
    for (const c of r.colourways ?? []) {
      expect(parseHash(routeFor(r.id, c.id))).toEqual({ kind: 'racquet', id: r.id, colourway: c.id });
      expect(parseHash(buildRoute(r.id, c.id, 'v=1'))).toEqual({ kind: 'build', id: r.id, colourway: c.id, query: 'v=1' });
    }
    expect(parseHash(brandRoute(r.brand, r.lineage))).toEqual({ kind: 'brand', slug: brandSlug(r.brand), lineage: r.lineage });
  }
  for (const b of new Set(catalog.racquets.map((r) => r.brand))) {
    expect(parseHash(brandRoute(b))).toEqual({ kind: 'brand', slug: brandSlug(b), lineage: null });
    expect(brandNamed(brandSlug(b), [b])).toBe(b);
  }
  expect(strings.length).toBeGreaterThan(0);
  const stringBrands = [...new Set(strings.map((s) => s.brand))];
  for (const b of stringBrands) {
    expect(parseHash(stringsRoute(brandSlug(b)))).toEqual({ kind: 'string-brand', slug: brandSlug(b) });
    expect(brandNamed(brandSlug(b), stringBrands)).toBe(b);
  }
  for (const s of strings) {
    expect(parseHash(stringRoute(s.id))).toEqual({ kind: 'string', id: s.id, colour: null });
    for (const c of s.colours) expect(parseHash(stringRoute(s.id, c.id))).toEqual({ kind: 'string', id: s.id, colour: c.id });
  }
});

test('unknown brand slugs name no brand', () => {
  expect(brandNamed('nope', ['Babolat', 'Head'])).toBeNull();
});

test('no racquet or placeholder is called b, build or strings', () => {
  const ids = [...catalog.racquets.map((r) => r.id), ...(catalog.placeholders ?? []).map((p) => p.id)];
  for (const reserved of ['b', 'build', 'strings']) expect(ids).not.toContain(reserved);
});

test('no string is called b: #/strings/b/<brand> is a brand floor', () => {
  expect(strings.map((s) => s.id)).not.toContain('b');
});

test('a filtered floor has its own address, and nothing picked is the floor itself', () => {
  expect(parseHash('#/find?play=spin')).toEqual({ kind: 'find', query: 'play=spin' });
  expect(parseHash('#/strings/find?value=1')).toEqual({ kind: 'string-find', query: 'value=1' });
  expect(parseHash('#/find')).toEqual({ kind: 'find', query: '' });
  expect(findRoute('')).toBe('#/');
  expect(findRoute('play=spin')).toBe('#/find?play=spin');
  expect(stringFindRoute('')).toBe('#/strings');
  expect(stringFindRoute('value=1')).toBe('#/strings/find?value=1');
});
