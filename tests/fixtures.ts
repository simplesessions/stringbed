import { parseSpec, type RacquetSpec } from '../src/core/spec';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

const base = {
  id: 'test-racquet-100',
  brand: 'Test',
  line: 'Line',
  model: 'Racquet 100',
  generation: '2026',
  year: 2026,
  specs: { headSizeSqIn: 100, lengthIn: 27, stringPattern: [16, 19], beamMm: [24, 24, 24] },
  geometry: {
    head: { shape: 'oval', aspect: 1.3 },
    beam: { profile: 'box' },
    throat: { style: 'open-v', bridge: 'curved' },
    features: [],
  },
  paint: { base: '#ffd400', finish: 'matte', zones: [] },
  parts: {
    grip: { color: '#111111' },
    collar: { color: '#ffd400' },
    buttCap: { color: '#111111' },
    strings: { color: '#eeeeee', gaugeMm: 1.25 },
    grommets: { color: '#111111' },
    bumper: { color: '#111111' },
    dampener: null,
  },
  sources: [],
  verified: false,
};

function merge(a: any, b: any): any {
  if (b === undefined) return a;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out: any = { ...a };
    for (const k of Object.keys(b)) out[k] = merge(a[k], b[k]);
    return out;
  }
  return b;
}

/** A valid RacquetSpec (validated through parseSpec) with deep overrides. */
export function makeSpec(overrides: DeepPartial<RacquetSpec> = {}): RacquetSpec {
  return parseSpec(merge(base, overrides), 'fixture');
}
