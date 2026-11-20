import { test, expect } from 'bun:test';
import type * as THREE from 'three';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { buildFrame } from '../../src/core/frame';
import { computeLayout } from '../../src/core/layout';
import { applyPaint, hexToLinear, paintColorAt, zonedAt } from '../../src/core/paint';
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
test('real camo patterns contrast with the base and every zone (linear luma > 0.2)', () => {
  const luma = (h: string) => { const [r, g, b] = hexToLinear(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const s of loadAllSpecs().filter((x) => x.paint.pattern)) {
    const p = luma(s.paint.pattern!.color);
    expect(Math.abs(p - luma(s.paint.base)), `${s.id} base`).toBeGreaterThan(0.2);
    for (const z of s.paint.zones) expect(Math.abs(p - luma(z.color)), `${s.id} zone ${z.from}`).toBeGreaterThan(0.2);
  }
});
test('camo paints the bare base only: zones stay solid', () => {
  const p: RacquetSpec['paint'] = { ...camoPaint, zones: [{ from: 0.8, to: 1, color: '#000000', blend: 0.02 }] };
  expect(zonedAt(p, 0.9)).toBe(true); expect(zonedAt(p, 0.5)).toBe(false); expect(zonedAt(p, 0.805)).toBe(false);
  const f = frameOf(spec); applyPaint(f, p);
  const c = f.getAttribute('color'), u = f.getAttribute('u'); const pc = hexToLinear(p.pattern!.color);
  let inZone = 0, outside = 0, camoOutside = 0;
  for (let i = 0; i < c.count; i++) {
    const isCamo = Math.abs(c.getX(i) - pc[0]) < 1e-6;
    if (u.getX(i) >= 0.82) { inZone++; expect(isCamo).toBe(false); expect(c.getX(i)).toBe(0); }
    else if (u.getX(i) < 0.78) { outside++; if (isCamo) camoOutside++; }
  }
  expect(inZone).toBeGreaterThan(0); expect(camoOutside / outside).toBeGreaterThan(0.15);
});
test('camo streaks run across the racquet: the pattern changes faster along y than along x', () => {
  // A flat, dense grid in the frame's own space (z = 0), painted away from any zone.
  const n = 200, step = 0.002, pos: number[] = [], us: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pos.push(i * step, j * step, 0); us.push(0.5); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('u', new Float32BufferAttribute(us, 1));
  applyPaint(g, camoPaint);
  const c = g.getAttribute('color'); const at = (i: number, j: number) => c.getX(j * n + i);
  let fx = 0, fy = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { if (at(i + 1, j) !== at(i, j)) fx++; if (at(i, j + 1) !== at(i, j)) fy++; }
  expect(fx).toBeGreaterThan(0);
  expect(fy).toBeGreaterThan(fx * 1.5);
});
test('applyPaint explains a frame missing u', () => {
  const g = frameOf(spec); g.deleteAttribute('u');
  expect(() => applyPaint(g, camoPaint)).toThrow(/"u"/);
});
