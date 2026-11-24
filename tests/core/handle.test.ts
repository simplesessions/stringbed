import { test, expect } from 'bun:test';
import type * as THREE from 'three';
import { buildButtCap, buildCollar, buildGrip } from '../../src/core/handle';
import { computeLayout } from '../../src/core/layout';
import { HOOP_RADIAL } from '../../src/core/section';
import { loadAllSpecs } from '../../src/core/spec';
import { makeSpec } from '../fixtures';

const spec = makeSpec();
const layout = computeLayout(spec, HOOP_RADIAL[spec.geometry.beam.profile]);
const box = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;

/** Every triangle faces away from the Y axis (side faces) or along Y (caps). */
function facesOutward(g: THREE.BufferGeometry): boolean {
  const p = g.getAttribute('position'); const idx = g.index!;
  const b = box(g); const yMid = (b.min.y + b.max.y) / 2;
  for (let t = 0; t < idx.count; t += 3) {
    const [a, b2, c] = [0, 1, 2].map((k) => idx.getX(t + k));
    const v = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)];
    const A = v(a), B = v(b2), C = v(c);
    const e1 = B.map((x, i) => x - A[i]), e2 = C.map((x, i) => x - A[i]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const cen = [0, 1, 2].map((i) => (A[i] + B[i] + C[i]) / 3);
    const out = [cen[0], cen[1] - yMid, cen[2]];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] <= 0) return false;
  }
  return true;
}

test('grip is octagonal and spans butt cap to grip top', () => {
  const g = buildGrip(spec, layout); g.computeBoundingBox();
  expect(g.boundingBox!.max.y).toBeCloseTo(layout.gripTopY, 3);
  expect(g.boundingBox!.max.x * 2).toBeGreaterThan(0.028); expect(g.boundingBox!.max.x * 2).toBeLessThan(0.040);
});
test('grip is an octagon: 8 faces, 16 triangles, flats along x and z', () => {
  const g = buildGrip(spec, layout);
  expect(tris(g)).toBe(16);
  const b = box(g);
  expect(b.max.x).toBeCloseTo(b.max.z, 6); expect(b.min.x).toBeCloseTo(-b.max.x, 6);
  expect(facesOutward(g)).toBe(true);
});
test('butt cap sits on the origin and is wider than the grip', () => {
  const c = buildButtCap(spec, layout); c.computeBoundingBox(); const g = buildGrip(spec, layout); g.computeBoundingBox();
  expect(c.boundingBox!.min.y).toBeCloseTo(0, 5); expect(c.boundingBox!.max.x).toBeGreaterThan(g.boundingBox!.max.x);
  expect(c.boundingBox!.max.y).toBeCloseTo(0.02, 5);
  expect(facesOutward(c)).toBe(true);
});
test('collar is a band about 0.012 tall straddling the grip top', () => {
  const c = buildCollar(spec, layout); const b = box(c);
  expect(b.max.y - b.min.y).toBeCloseTo(0.012, 3);
  expect(b.min.y).toBeLessThan(layout.gripTopY); expect(b.max.y).toBeGreaterThan(layout.gripTopY);
  expect(b.max.x).toBeGreaterThan(box(buildGrip(spec, layout)).max.x);
  expect(facesOutward(c)).toBe(true);
});
test('handle parts are small and fit the real racquets', () => {
  for (const s of loadAllSpecs()) {
    const l = computeLayout(s, HOOP_RADIAL[s.geometry.beam.profile]);
    expect(tris(buildGrip(s, l)) + tris(buildCollar(s, l)) + tris(buildButtCap(s, l))).toBeLessThan(120);
    expect(box(buildGrip(s, l)).max.y).toBeCloseTo(l.gripTopY, 5);
  }
});

test('elongationMm makes every handle part wider in the string plane than deep, at the same girth', () => {
  const e = 5.2;
  const long = makeSpec({ geometry: { ...spec.geometry, handle: { elongationMm: e } } });
  for (const build of [buildGrip, buildCollar, buildButtCap]) {
    const plain = box(build(spec, layout)), b = box(build(long, layout));
    expect((b.max.x - b.max.z) * 2).toBeCloseTo(e / 1000, 6); // X is in the string plane, Z is the face normal
    expect(b.max.x + b.max.z).toBeCloseTo(plain.max.x + plain.max.z, 6);
    expect([b.min.y, b.max.y]).toEqual([plain.min.y, plain.max.y]);
    expect(tris(build(long, layout))).toBe(tris(build(spec, layout)));
    expect(facesOutward(build(long, layout))).toBe(true);
  }
});
test('an elongated grip keeps its corner bevels at 45 degrees', () => {
  const g = buildGrip(makeSpec({ geometry: { ...spec.geometry, handle: { elongationMm: 5.2 } } }), layout);
  const p = g.getAttribute('position');
  const pts = new Map<string, [number, number]>();
  const yMin = box(g).min.y;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - yMin) < 1e-6) pts.set(`${p.getX(i).toFixed(6)},${p.getZ(i).toFixed(6)}`, [p.getX(i), p.getZ(i)]);
  const ring = [...pts.values()].sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  expect(ring).toHaveLength(8);
  const dirs = ring.map((a, i) => { const b = ring[(i + 1) % 8]; return [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])]; });
  const diagonal = dirs.filter(([x, z]) => x > 1e-4 && z > 1e-4);
  expect(diagonal).toHaveLength(4);
  for (const [x, z] of diagonal) expect(x).toBeCloseTo(z, 5);
});
test('no elongation, or zero, is the plain octagon exactly', () => {
  const zero = makeSpec({ geometry: { ...spec.geometry, handle: { elongationMm: 0 } } });
  expect(Array.from(buildGrip(zero, layout).getAttribute('position').array)).toEqual(Array.from(buildGrip(spec, layout).getAttribute('position').array));
});
