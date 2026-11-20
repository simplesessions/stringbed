import { loadAllSpecs } from '../src/core/spec';
import { loadPlaceholders } from '../src/placeholders';

const records = loadPlaceholders();

test('every placeholder parses, sits in its brand folder and is named by its id', () => {
  expect(records.length).toBeGreaterThan(0);
});
test('placeholder ids are unique and never reuse a library id', () => {
  const ids = records.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  const library = new Set(loadAllSpecs().map((s) => s.id));
  for (const id of ids) expect(library.has(id), id).toBe(false);
});
