import { loadAllSpecs } from '../src/core/spec';

const specs = loadAllSpecs();

test('every spec parses and ids are unique', () => {
  expect(specs.length).toBe(14);
  expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
});
test('five brands, at least two and at most three racquets each', () => {
  const byBrand = Object.groupBy(specs, (s) => s.brand);
  expect(Object.keys(byBrand).sort()).toEqual(['Babolat', 'Prince', 'Solinco', 'Wilson', 'Yonex']);
  for (const list of Object.values(byBrand)) {
    expect(list!.length).toBeGreaterThanOrEqual(2);
    expect(list!.length).toBeLessThanOrEqual(3);
  }
});
test('every Yonex head is isometric', () => {
  for (const s of specs.filter((s) => s.brand === 'Yonex')) expect(s.geometry.head.shape).toBe('isometric');
});
test('every Solinco has a camo pattern', () => {
  for (const s of specs.filter((s) => s.brand === 'Solinco')) expect(s.paint.pattern?.type).toBe('camo');
});
test('every spec is sourced and carries a boolean verified flag', () => {
  for (const s of specs) {
    expect(s.sources.length).toBeGreaterThan(0);
    expect(typeof s.verified).toBe('boolean');
  }
});
test('no spec has a dampener', () => {
  for (const s of specs) expect(s.parts.dampener).toBeNull();
});
