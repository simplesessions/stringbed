import type * as THREE from 'three';
import { buildFrame } from '../../src/core/frame';
import { computeLayout } from '../../src/core/layout';
import { applyPaint, hexToLinear, paintColorAt } from '../../src/core/paint';
import { HOOP_RADIAL } from '../../src/core/section';
import { loadAllSpecs, type RacquetSpec } from '../../src/core/spec';
import { makeSpec } from '../fixtures';

const frameOf = (s: RacquetSpec) => buildFrame(s, computeLayout(s, HOOP_RADIAL[s.geometry.beam.profile]));
const spec = makeSpec();
const colors = (g: THREE.BufferGeometry) => Array.from(g.getAttribute('color').array as ArrayLike<number>);
const camoPaint: RacquetSpec['paint'] = {
  base: '#ffffff', finish: 'matte', zones: [], pattern: { type: 'camo', color: '#222222', scale: 1, seed: 7 },
};
function share(g: THREE.BufferGeometry, rgb: number[]) {
  const c = g.getAttribute('color'); let n = 0;
  for (let i = 0; i < c.count; i++) if (Math.abs(c.getX(i) - rgb[0]) < 1e-6 && Math.abs(c.getY(i) - rgb[1]) < 1e-6 && Math.abs(c.getZ(i) - rgb[2]) < 1e-6) n++;
  return n / c.count;
}

test('base colour where no zone applies', () => {
  expect(paintColorAt({ base: '#ffffff', finish: 'gloss', zones: [{ from: 0.5, to: 0.8, color: '#000000' }] }, 0.2)).toEqual([1, 1, 1]);
});
test('zone colour inside a zone; later zones win', () => {
  const p = { base: '#ffffff', finish: 'gloss' as const, zones: [{ from: 0.4, to: 0.9, color: '#000000' }, { from: 0.6, to: 0.7, color: '#ff0000' }] };
  expect(paintColorAt(p, 0.5)).toEqual([0, 0, 0]); expect(paintColorAt(p, 0.65)).toEqual([1, 0, 0]);
});
test('blend fades between base and zone', () => {
  const c = paintColorAt({ base: '#ffffff', finish: 'gloss', zones: [{ from: 0.5, to: 0.9, color: '#000000', blend: 0.1 }] }, 0.55);
  expect(c[0]).toBeGreaterThan(0.05); expect(c[0]).toBeLessThan(0.95);
});
test('blend fades out at the far end too and is full strength in the middle', () => {
  const p = { base: '#ffffff', finish: 'gloss' as const, zones: [{ from: 0.5, to: 0.9, color: '#000000', blend: 0.1 }] };
  const c = paintColorAt(p, 0.85); expect(c[0]).toBeGreaterThan(0.05); expect(c[0]).toBeLessThan(0.95);
  expect(paintColorAt(p, 0.7)).toEqual([0, 0, 0]); expect(paintColorAt(p, 0.5)).toEqual([1, 1, 1]);
});
test('applyPaint writes one colour per vertex', () => {
  const frame = frameOf(spec);
  applyPaint(frame, { base: '#ffd400', finish: 'matte', zones: [{ from: 0.4, to: 0.9, color: '#000000' }] });
  expect(frame.getAttribute('color').itemSize).toBe(3);
  expect(frame.getAttribute('color').count).toBe(frame.getAttribute('position').count);
});
test('camo is deterministic and uses both colours', () => {
  const a = frameOf(spec), b = frameOf(spec); applyPaint(a, camoPaint); applyPaint(b, camoPaint);
  expect(colors(a)).toEqual(colors(b));
  const s = share(a, hexToLinear(camoPaint.pattern!.color));
  expect(s).toBeGreaterThan(0.15); expect(s).toBeLessThan(0.85);
});
test('camo seed changes the pattern', () => {
  const a = frameOf(spec), b = frameOf(spec);
  applyPaint(a, camoPaint); applyPaint(b, { ...camoPaint, pattern: { ...camoPaint.pattern!, seed: 8 } });
  expect(colors(a)).not.toEqual(colors(b));
});
test('real camo specs mix both colours', () => {
  const camo = loadAllSpecs().filter((s) => s.paint.pattern);
  expect(camo.length).toBeGreaterThan(0);
  for (const s of camo) {
    const f = frameOf(s); applyPaint(f, s.paint);
    const v = share(f, hexToLinear(s.paint.pattern!.color));
    expect(v, s.id).toBeGreaterThan(0.15); expect(v, s.id).toBeLessThan(0.85);
  }
});
