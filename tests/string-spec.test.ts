import { test, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllStrings, parseString } from '../src/string-spec';

const silver = { id: 'silver', name: 'Silver', hex: '#c0c4c8' };
const valid = {
  id: 'luxilon-alu-power',
  brand: 'Luxilon',
  name: 'ALU Power',
  material: 'polyester',
  shape: { sides: 0, label: 'Round' },
  gaugesMm: [1.25, 1.3],
  colours: [silver],
  finish: 'satin',
  summary: 'A firm, stiff co-polyester string with an aluminium-flecked look that has long been a staple of the pro tour. It rewards full swings with control and a crisp, low-powered feel, and holds its tension well.',
  bestFor: ['control', 'durability'],
  ratings: { power: 2, spin: 3, control: 5, comfort: 1, feel: 3, durability: 4 },
  compared: [],
  confidence: 'medium',
  sources: ['https://example.com/alu-power'],
  researchedOn: '2026-11-24',
  verified: false,
};

test('a valid string parses', () => expect(parseString(valid, 'f').id).toBe('luxilon-alu-power'));
test.each([
  ['colours.0.hex', { colours: [{ id: 'silver', name: 'Silver', hex: '#12G' }] }],
  ['colours', { colours: [silver, silver] }],
  ['colours', { colours: [] }],
  ['gaugesMm', { gaugesMm: [] }],
  ['gaugesMm', { gaugesMm: [1.3, 1.25] }],
  ['gaugesMm', { gaugesMm: [1.25, 1.25] }],
  ['gaugesMm.0', { gaugesMm: [0.9] }],
  ['shape.sides', { shape: { sides: 2, label: 'Flat' } }],
  ['shape.sides', { shape: { sides: 13, label: 'Flat' } }],
  ['shape.twisted', { shape: { sides: 5, label: 'Pentagon', twisted: false } }],
  ['ratings.spin', { ratings: { ...valid.ratings, spin: 6 } }],
  ['ratings.spin', { ratings: { ...valid.ratings, spin: 2.5 } }],
  ['summary', { summary: 'Too short.' }],
  ['summary', { summary: Array(61).fill('word').join(' ') }],
  ['bestFor', { bestFor: [] }],
  ['bestFor.0', { bestFor: ['weight'] }],
  ['compared', { compared: ['a', 'b', 'c', 'd'] }],
  ['sources', { sources: [] }],
  ['researchedOn', { researchedOn: '24/11/2026' }],
])('bad %s is rejected with the file and field', (path, patch) =>
  expect(() => parseString({ ...valid, ...patch }, 'luxilon/x.json')).toThrow(`luxilon/x.json: ${path}`));
test('shape may be null, and may carry twisted or rough', () => {
  expect(parseString({ ...valid, shape: null }, 'f').shape).toBeNull();
  expect(parseString({ ...valid, shape: { sides: 5, label: 'Pentagon', twisted: true } }, 'f').shape?.twisted).toBe(true);
});
test('every file is named by its id, filed under its brand, and compares to real strings', () => {
  const all = loadAllStrings();
  expect(all.length).toBeGreaterThan(0);
  const ids = new Set(all.map((s) => s.id));
  expect(ids.size).toBe(all.length);
  for (const s of all) for (const c of s.compared) expect(ids.has(c) && c !== s.id, `${s.id} -> ${c}`).toBe(true);
});

test('malformed JSON names the file it came from', () => {
  const dir = mkdtempSync(join(tmpdir(), 'strings-'));
  mkdirSync(join(dir, 'acme'));
  writeFileSync(join(dir, 'acme', 'acme-broken.json'), '{ "id": ');
  expect(() => loadAllStrings(dir)).toThrow(new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/acme/acme-broken\\.json: `));
});
