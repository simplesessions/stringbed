import type * as THREE from 'three';
import { computeLayout } from '../../src/core/layout';
import { headOutline, outlineHalfWidthAt } from '../../src/core/outline';
import { HOOP_RADIAL } from '../../src/core/section';
import { loadAllSpecs, type RacquetSpec } from '../../src/core/spec';
import { buildCrosses, buildMains, mainPositions, stringBed } from '../../src/core/strings';
import { makeSpec } from '../fixtures';

const layoutOf = (s: RacquetSpec) => computeLayout(s, HOOP_RADIAL[s.geometry.beam.profile]);
const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;
const spec1619 = makeSpec({ specs: { stringPattern: [16, 19] } });
const spec1618 = makeSpec({ specs: { stringPattern: [16, 18] } });
const spec1820 = makeSpec({ specs: { stringPattern: [18, 20] } });
const layout = layoutOf(spec1619);

test('main positions are symmetric for even and odd counts', () => {
  for (const n of [16, 17, 18]) {
    const xs = mainPositions(n, 0.25); expect(xs).toHaveLength(n);
    for (let i = 0; i < n; i++) expect(xs[i]).toBeCloseTo(-xs[n - 1 - i], 6);
  }
  expect(mainPositions(17, 0.25)[8]).toBeCloseTo(0, 6);
  expect(mainPositions(16, 0.25).every(x => Math.abs(x) > 1e-4)).toBe(true);
});
test('mains are spaced tighter in the centre than at the edges, and ascend', () => {
  const xs = mainPositions(18, 0.25);
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  expect(xs[9] - xs[8]).toBeLessThan(xs[1] - xs[0]);
  expect(xs[17]).toBeCloseTo(0.125, 6);
});
test('strings stay inside the head and match the pattern', () => {
  const m = buildMains(spec1619, layout), c = buildCrosses(spec1619, layout);
  expect(m.index!.count / 3).toBe(16 * 8); expect(c.index!.count / 3).toBe(19 * 8);
  m.computeBoundingBox(); expect(m.boundingBox!.max.y).toBeLessThan(layout.tipY); expect(m.boundingBox!.min.y).toBeGreaterThan(layout.bridgeY - 0.002);
});
test('18x20 has more string triangles than 16x18', () => {
  expect(tris(buildMains(spec1820, layout)) + tris(buildCrosses(spec1820, layout))).toBeGreaterThan(tris(buildMains(spec1618, layout)) + tris(buildCrosses(spec1618, layout)));
});
test('strings lie at z about 0, mains and crosses apart, gauge wide', () => {
  const m = buildMains(spec1619, layout), c = buildCrosses(spec1619, layout);
  m.computeBoundingBox(); c.computeBoundingBox();
  const g = spec1619.parts.strings.gaugeMm / 1000;
  expect(m.boundingBox!.max.z).toBeCloseTo(0.0003 + g / 2, 6); expect(c.boundingBox!.min.z).toBeCloseTo(-0.0003 - g / 2, 6);
  expect(m.boundingBox!.max.z - m.boundingBox!.min.z).toBeCloseTo(g, 6);
});
test('every real racquet: no string vertex outside the inner outline, mains clear the bridge', () => {
  for (const s of loadAllSpecs()) {
    const l = layoutOf(s);
    const loop = headOutline(s.geometry.head.shape, s.specs.headSizeSqIn, s.geometry.head.aspect, 256).map((p) => ({ x: p.x, y: p.y + l.headCenterY }));
    const bed = stringBed(s, l);
    for (const g of [buildMains(s, l), buildCrosses(s, l)]) {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        expect(Math.abs(x)).toBeLessThanOrEqual(outlineHalfWidthAt(loop, y) + 0.0003);
        expect(y).toBeGreaterThanOrEqual(bed.lowerY(x) - 0.0003);
      }
    }
    const m = buildMains(s, l); m.computeBoundingBox();
    expect(m.boundingBox!.min.y).toBeGreaterThan(l.bridgeY - 0.002);
    expect(m.boundingBox!.max.y).toBeLessThan(l.tipY);
  }
});
test('flat bridges: mains start above the bridge top, not inside it', () => {
  const s = makeSpec({ geometry: { throat: { style: 'open-v', bridge: 'flat' } } });
  const l = layoutOf(s); const m = buildMains(s, l); m.computeBoundingBox();
  expect(m.boundingBox!.min.y).toBeGreaterThan(l.bridgeY + 0.006);
});
test('string prisms face outward', () => {
  const g = buildCrosses(spec1619, layout); const p = g.getAttribute('position'); const idx = g.index!;
  // first prism: axis along x at y0; outward = away from that axis in (y, z)
  const cy = (p.getY(0) + p.getY(4)) / 2; // y of the axis: opposite corners of the first prism
  for (let t = 0; t < 8 * 3; t += 3) {
    const v = (k: number) => [p.getX(idx.getX(t + k)), p.getY(idx.getX(t + k)), p.getZ(idx.getX(t + k))];
    const A = v(0), B = v(1), C = v(2);
    const e1 = B.map((x, i) => x - A[i]), e2 = C.map((x, i) => x - A[i]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const cen = [0, 1, 2].map((i) => (A[i] + B[i] + C[i]) / 3);
    expect(n[1] * (cen[1] - cy) + n[2] * (cen[2] + 0.0003)).toBeGreaterThan(0);
  }
});
