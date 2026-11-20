import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllSpecs, parseSpec, type RacquetSpec } from '../../src/core/spec';

const good: RacquetSpec = {
  id: 'babolat-pure-aero-100',
  brand: 'Babolat',
  line: 'Pure Aero',
  model: 'Pure Aero 100',
  generation: '2026',
  year: 2026,
  specs: {
    headSizeSqIn: 100,
    lengthIn: 27,
    stringPattern: [16, 19],
    beamMm: [26, 26, 26],
    unstrungWeightG: 300,
  },
  geometry: {
    head: { shape: 'oval', aspect: 1.3 },
    beam: { profile: 'aero' },
    throat: { style: 'open-v', bridge: 'curved' },
    features: [],
  },
  paint: {
    base: '#ffd400',
    finish: 'matte',
    zones: [{ from: 0.35, to: 0.55, color: '#111111', blend: 0.1 }],
  },
  parts: {
    grip: { color: '#111111' },
    collar: { color: '#ffd400' },
    buttCap: { color: '#111111' },
    strings: { color: '#eeeeee', gaugeMm: 1.25 },
    grommets: { color: '#111111' },
    bumper: { color: '#111111' },
    dampener: null,
  },
  sources: ['https://example.com/pure-aero'],
  verified: true,
};

describe('parseSpec', () => {
  test('accepts a valid spec', () => {
    expect(parseSpec(good, 'x.json').id).toBe(good.id);
  });
  test('rejects a bad colour, naming file and field', () => {
    const bad = structuredClone(good);
    bad.paint.base = '#12G';
    expect(() => parseSpec(bad, 'babolat/x.json')).toThrow(/babolat\/x\.json.*paint\.base/s);
  });
  test('rejects an unknown head shape', () => {
    const bad: any = structuredClone(good);
    bad.geometry.head.shape = 'square';
    expect(() => parseSpec(bad, 'x.json')).toThrow(/geometry\.head\.shape/);
  });
  test('rejects a zero-main string pattern', () => {
    const bad = structuredClone(good);
    bad.specs.stringPattern = [0, 19];
    expect(() => parseSpec(bad, 'x.json')).toThrow(/stringPattern/);
  });
  test('rejects a zone with from >= to', () => {
    const bad = structuredClone(good);
    bad.paint.zones = [{ from: 0.6, to: 0.4, color: '#ffffff' }];
    expect(() => parseSpec(bad, 'x.json')).toThrow(/zones/);
  });
  test('rejects a non-kebab-case id', () => {
    const bad = structuredClone(good);
    bad.id = 'Pure Aero';
    expect(() => parseSpec(bad, 'x.json')).toThrow(/x\.json: id/);
  });
});

describe('loadAllSpecs', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stringbed-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (brandDir: string, id: string, spec: RacquetSpec) => {
    mkdirSync(join(dir, brandDir), { recursive: true });
    writeFileSync(join(dir, brandDir, `${id}.json`), JSON.stringify(spec));
  };

  test('sorts by brand then model and matches id to file name', () => {
    write('wilson', 'wilson-blade-98', { ...good, id: 'wilson-blade-98', brand: 'Wilson', model: 'Blade 98' });
    write('babolat', 'babolat-pure-drive', { ...good, id: 'babolat-pure-drive', model: 'Pure Drive' });
    write('babolat', 'babolat-pure-aero-100', good);
    expect(loadAllSpecs(dir).map((s) => s.id)).toEqual([
      'babolat-pure-aero-100',
      'babolat-pure-drive',
      'wilson-blade-98',
    ]);
  });

  test('throws naming the file on malformed JSON', () => {
    mkdirSync(join(dir, 'babolat'), { recursive: true });
    writeFileSync(join(dir, 'babolat', 'broken.json'), '{ not json');
    expect(() => loadAllSpecs(dir)).toThrow(/babolat\/broken\.json: invalid JSON/);
  });

  test('rejects uppercase hex colours', () => {
    const bad = structuredClone(good);
    bad.paint.base = '#FFD400';
    expect(() => parseSpec(bad, 'x.json')).toThrow(/paint\.base/);
  });

  test('throws naming the file when id does not match', () => {
    write('babolat', 'babolat-other', good);
    expect(() => loadAllSpecs(dir)).toThrow(/babolat-other\.json/);
  });
});
