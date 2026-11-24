import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '../../src/catalog';
import { lineupOf, neighboursOf, stepName, versionSpecs, wallGroups, AGES, type Racquet, type Version } from '../../site/src/catalog-view';

const catalog: Catalog = JSON.parse(readFileSync(join(__dirname, '../../assets/catalog.json'), 'utf8'));
const get = (id: string): Racquet => {
  const r = catalog.racquets.find((x) => x.id === id);
  if (!r) throw new Error(`no ${id}`);
  return r;
};
const labels = (vs: Version[]) => vs.map((v) => v.racquet.variantLabel);

test('adult versions read by head size, then length, then weight, the base first in its group', () => {
  expect(labels(lineupOf(catalog, get('babolat-pure-drive-100')).adult)).toEqual(['98', '100', 'Team', 'Lite', 'Super Lite', 'Plus', '107']);
});

test('the base leads its group even when it has no listed weight and another version does', () => {
  const adult = labels(lineupOf(catalog, get('babolat-pure-aero-100-2018')).adult);
  expect(adult[0]).toBe('100');
  expect(adult.indexOf('Team')).toBe(1); // the only listed weight comes before the blanks
  expect(adult.at(-1)).toBe('Plus'); // longer, so last
});

test('juniors read by length and fold a colour into the frame it is a colour of', () => {
  const { junior } = lineupOf(catalog, get('babolat-pure-drive-100'));
  expect(labels(junior)).toEqual(['Drive Junior 23', 'Drive Junior 24', 'Junior 25', 'Drive Junior 25', 'Junior 26']);
  const j25 = junior.find((v) => v.racquet.variantLabel === 'Junior 25')!;
  expect(j25.colours.map((c) => [c.name, c.racquetId, c.colourway])).toEqual([
    ['Standard', j25.racquet.id, null],
    ['Light Blue', 'babolat-pure-drive-junior-25-light-blue-2025', null],
  ]);
});

test("a racquet's own colourways are listed on its row", () => {
  const { adult } = lineupOf(catalog, get('yonex-ezone-100'));
  const base = adult.find((v) => v.racquet.id === 'yonex-ezone-100')!;
  expect(base.colours.map((c) => c.name)).toContain('Espresso Brown');
  expect(base.colours[0].colourway).toBeNull();
});

test('a version in one colour lists no colours', () => {
  const team = lineupOf(catalog, get('babolat-pure-drive-100')).adult.find((v) => v.racquet.variantLabel === 'Team')!;
  expect(team.colours).toEqual([]);
});

test('every variant of every family is reachable from its line-up exactly once', () => {
  for (const f of catalog.racquets.filter((r) => !r.variantOf && r.variants?.length)) {
    const { adult, junior } = lineupOf(catalog, f);
    const ids = [...adult, ...junior].flatMap((v) => [v.racquet.id, ...v.colours.map((c) => c.racquetId).filter((id) => id !== v.racquet.id)]);
    expect([...new Set(ids)].sort()).toEqual(f.variants!.map((v) => v.id).sort());
    const rows = [...adult, ...junior].map((v) => v.racquet.id);
    expect(new Set(rows).size).toBe(rows.length);
  }
});

test('a colour is only folded in when the listed frames agree', () => {
  for (const f of catalog.racquets.filter((r) => !r.variantOf && r.variants?.length)) {
    const { adult, junior } = lineupOf(catalog, f);
    for (const v of [...adult, ...junior]) {
      for (const c of v.colours) {
        const s = get(c.racquetId).specs;
        expect([s.headSizeSqIn, s.lengthIn, s.stringPattern, s.beamMm]).toEqual([v.racquet.specs.headSizeSqIn, v.racquet.specs.lengthIn, v.racquet.specs.stringPattern, v.racquet.specs.beamMm]);
      }
    }
  }
});

test('version specs: what is listed, and which values differ from the base', () => {
  const base = get('babolat-pure-drive-100');
  expect(versionSpecs(get('babolat-pure-drive-team-2025'), base)).toEqual([
    { key: 'head', text: '100 in²', differs: false },
    { key: 'pattern', text: '16 × 19', differs: false },
    { key: 'weight', text: '285 g', differs: true },
    { key: 'length', text: '', differs: false },
  ]);
  const plus = versionSpecs(catalog.racquets.find((r) => r.variantOf === base.id && r.variantLabel === 'Plus')!, base);
  expect(plus.find((s) => s.key === 'length')).toEqual({ key: 'length', text: '27.5 in', differs: true });
});

test('a missing weight is blank and never counts as a difference', () => {
  const weight = versionSpecs(get('babolat-pure-drive-98-2025'), get('babolat-pure-drive-100')).find((s) => s.key === 'weight');
  expect(weight).toEqual({ key: 'weight', text: '', differs: false });
});

test('a junior always shows its length', () => {
  const j = lineupOf(catalog, get('babolat-pure-drive-100')).junior[0].racquet;
  expect(versionSpecs(j, null).find((s) => s.key === 'length')).toEqual({ key: 'length', text: '23 in', differs: false });
});

test('the arrows step from line to line, never to another generation of the line on show', () => {
  for (const age of AGES) {
    const order = wallGroups(catalog, age, false).flatMap((g) => g.racquets);
    for (const r of order) {
      const { prev, next } = neighboursOf(order, r);
      expect(prev.lineage).not.toBe(r.lineage);
      expect(next.lineage).not.toBe(r.lineage);
    }
  }
});

test('an older generation steps from its line\'s place on the wall', () => {
  const order = wallGroups(catalog, 'adult', false).flatMap((g) => g.racquets);
  const now = neighboursOf(order, get('babolat-pure-drive-100'));
  expect(neighboursOf(order, get('babolat-pure-drive-100-2020'))).toEqual(now);
});

test('a step is named so it cannot be mistaken for the page it leaves', () => {
  for (const age of AGES) {
    const order = wallGroups(catalog, age, false).flatMap((g) => g.racquets);
    for (const r of order) {
      const { prev, next } = neighboursOf(order, r);
      const here = stepName(r, r.brand);
      expect(stepName(prev, r.brand)).not.toBe(here);
      expect(stepName(next, r.brand)).not.toBe(here);
    }
  }
});

test('a step into another brand says so', () => {
  const pd = get('babolat-pure-drive-100');
  expect(stepName(pd, 'Babolat')).toBe('Pure Drive');
  expect(stepName(pd, 'Head')).toBe('Babolat Pure Drive');
  expect(stepName(get('babolat-pure-aero-rafa-2023'), 'Babolat')).toBe('Pure Aero Rafa');
});
