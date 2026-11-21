import { test, expect } from 'bun:test';
import { lineageOf, loadAllSpecs } from '../src/core/spec';

const specs = loadAllSpecs();

test('every spec parses and ids are unique', () => {
  // 72 frame families (one per generation); 228 more are their variants (other sizes).
  expect(specs.length).toBe(300);
  expect(specs.filter((s) => !s.variantOf)).toHaveLength(72);
  expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
});
test('a variant never carries another generation (sizes of one frame only)', () => {
  const families = new Map<string, { generation: string }>();
  for (const s of specs) if (!s.variantOf) families.set(s.id, s);
  for (const v of specs.filter((s) => s.variantOf)) {
    expect(v.generation, `${v.id} in ${v.variantOf}`).toBe(families.get(v.variantOf!)!.generation);
    expect(v.variantLabel ?? '', v.id).not.toMatch(/\((19|20)\d\d\)|\bold\b/i);
  }
});
test('within a lineage, each generation is one frame family', () => {
  const seen = new Map<string, string>();
  for (const s of specs.filter((x) => !x.variantOf)) {
    const key = `${lineageOf(s)}|${s.generation}|${s.year}`;
    expect(seen.get(key), `${s.id} duplicates ${seen.get(key)}`).toBeUndefined();
    seen.set(key, s.id);
  }
});
test('variants share brand and line with their family and have a label', () => {
  const byId = new Map(specs.map((s) => [s.id, s]));
  for (const v of specs.filter((s) => s.variantOf)) {
    const base = byId.get(v.variantOf!)!;
    expect(base, v.id).toBeDefined();
    expect([v.brand, v.line]).toEqual([base.brand, base.line]);
    expect(v.variantLabel, v.id).toBeTruthy();
    expect(base.variantLabel, base.id).toBeTruthy();
  }
});
test('six brands, at least one racquet each', () => {
  const byBrand = Object.groupBy(specs, (s) => s.brand);
  expect(Object.keys(byBrand).sort()).toEqual(['Babolat', 'Head', 'Prince', 'Solinco', 'Wilson', 'Yonex']);
  for (const list of Object.values(byBrand)) {
    expect(list!.length).toBeGreaterThanOrEqual(1);
  }
});
test('every Yonex head is isometric', () => {
  for (const s of specs.filter((s) => s.brand === 'Yonex')) expect(s.geometry.head.shape).toBe('isometric');
});
test('every Solinco Blackout and Whiteout has a camo pattern', () => {
  for (const s of specs.filter((s) => s.brand === 'Solinco' && s.line !== 'Prizm')) expect(s.paint.pattern?.type).toBe('camo');
});
test('every spec is verified and sourced', () => {
  for (const s of specs) { expect(s.verified, s.id).toBe(true); expect(s.sources.length).toBeGreaterThan(0); }
});
test('no spec has a dampener', () => {
  for (const s of specs) expect(s.parts.dampener).toBeNull();
});
test('every spec has 1-10 paint zones, none equal to the base colour', () => {
  for (const s of specs) {
    expect(s.paint.zones.length).toBeGreaterThanOrEqual(1);
    expect(s.paint.zones.length).toBeLessThanOrEqual(10);
    for (const z of s.paint.zones) expect(z.color).not.toBe(s.paint.base);
  }
});
