import { test, expect } from 'bun:test';
import { loadAllSpecs } from '../src/core/spec';

const specs = loadAllSpecs();

test('every spec parses and ids are unique', () => {
  expect(specs.length).toBe(15);
  expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
});
test('six brands, at least one and at most three racquets each', () => {
  const byBrand = Object.groupBy(specs, (s) => s.brand);
  expect(Object.keys(byBrand).sort()).toEqual(['Babolat', 'Head', 'Prince', 'Solinco', 'Wilson', 'Yonex']);
  for (const list of Object.values(byBrand)) {
    expect(list!.length).toBeGreaterThanOrEqual(1);
    expect(list!.length).toBeLessThanOrEqual(3);
  }
});
test('every Yonex head is isometric', () => {
  for (const s of specs.filter((s) => s.brand === 'Yonex')) expect(s.geometry.head.shape).toBe('isometric');
});
test('every Solinco has a camo pattern', () => {
  for (const s of specs.filter((s) => s.brand === 'Solinco')) expect(s.paint.pattern?.type).toBe('camo');
});
test('every spec is verified and sourced', () => {
  for (const s of specs) { expect(s.verified, s.id).toBe(true); expect(s.sources.length).toBeGreaterThan(0); }
});
test('no spec has a dampener', () => {
  for (const s of specs) expect(s.parts.dampener).toBeNull();
});
test('every spec has 2-5 paint zones, none equal to the base colour', () => {
  for (const s of specs) {
    expect(s.paint.zones.length).toBeGreaterThanOrEqual(2);
    expect(s.paint.zones.length).toBeLessThanOrEqual(5);
    for (const z of s.paint.zones) expect(z.color).not.toBe(s.paint.base);
  }
});
