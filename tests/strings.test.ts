import { test, expect } from 'bun:test';
import { loadAllStrings } from '../src/string-spec';

const strings = loadAllStrings();

test('at least ten brands, at least three strings each', () => {
  const by = Object.groupBy(strings, (s) => s.brand);
  expect(Object.keys(by).length).toBeGreaterThanOrEqual(10);
  for (const [brand, list] of Object.entries(by)) expect(list!.length, brand).toBeGreaterThanOrEqual(3);
});
test('every material is represented', () => expect(new Set(strings.map((s) => s.material)).size).toBe(4));
test('names do not repeat their brand, and brand plus name is unique', () => {
  for (const s of strings) expect(s.name.toLowerCase().includes(s.brand.toLowerCase()), s.id).toBe(false);
  const keys = strings.map((s) => `${s.brand} ${s.name}`.toLowerCase());
  expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
});
test('most strings have a source that is not Tennis Warehouse', () =>
  expect(strings.filter((s) => s.sources.some((u) => !u.includes('tennis-warehouse'))).length / strings.length).toBeGreaterThanOrEqual(0.8));
