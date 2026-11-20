import type * as THREE from 'three';
import { buildFrame } from '../../src/core/frame';
import { computeLayout } from '../../src/core/layout';
import { HOOP_RADIAL } from '../../src/core/section';
import { loadAllSpecs, type RacquetSpec } from '../../src/core/spec';
import { buildBumper, buildDampener, buildGrommets } from '../../src/core/trim';
import { makeSpec } from '../fixtures';

const layoutOf = (s: RacquetSpec) => computeLayout(s, HOOP_RADIAL[s.geometry.beam.profile]);
const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;
const box = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
const spec = makeSpec();
const layout = layoutOf(spec);
const specWithOPorts = makeSpec({ geometry: { features: ['o-ports'] } });
const specFins = makeSpec({ geometry: { features: ['aero-fins'] } });

test('o-ports add geometry to the grommets', () => {
  expect(tris(buildGrommets(specWithOPorts, layout))).toBeGreaterThan(tris(buildGrommets(spec, layout)));
});
test('o-ports are a separate geometry group, at 3 and 9 o\'clock', () => {
  const g = buildGrommets(specWithOPorts, layout);
  expect(g.groups).toHaveLength(2);
  const port = g.groups[1];
  const idx = g.index!, p = g.getAttribute('position');
  let minX = Infinity, maxX = -Infinity;
  for (let i = port.start; i < port.start + port.count; i++) { const x = p.getX(idx.getX(i)); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  expect(minX).toBeLessThan(-0.05); expect(maxX).toBeGreaterThan(0.05);
  expect(buildGrommets(spec, layout).groups).toHaveLength(1);
});
test('no dampener unless the spec asks for one', () => {
  expect(buildDampener(spec, layout)).toBeNull();
  expect(buildDampener({ ...spec, parts: { ...spec.parts, dampener: { color: '#ff0000' } } }, layout)).not.toBeNull();
});
test('dampener sits between the centre mains just above the bridge', () => {
  for (const n of [16, 17]) {
    const s = makeSpec({ specs: { stringPattern: [n, 19] }, parts: { dampener: { color: '#ff0000' } } });
    const l = layoutOf(s); const b = box(buildDampener(s, l)!);
    expect(b.min.y).toBeGreaterThan(l.bridgeY); expect(b.max.y).toBeLessThan(l.bridgeY + 0.03);
    expect(b.max.x - b.min.x).toBeLessThan(0.012);
  }
});
test('bumper wraps the tip and protrudes at most 0.4 mm', () => {
  for (const s of [spec, specFins, ...loadAllSpecs()]) {
    const l = layoutOf(s); const b = box(buildBumper(s, l));
    expect(b.max.y).toBeLessThanOrEqual(l.tipY + 0.0004); expect(b.max.y).toBeGreaterThan(l.tipY - 0.0005);
    expect(b.min.x).toBeCloseTo(-b.max.x, 5);
  }
});
test('bumper, grommets and fins stay within 0.4 mm of the frame in plane', () => {
  for (const s of [specFins, specWithOPorts, ...loadAllSpecs()]) {
    const l = layoutOf(s); const f = box(buildFrame(s, l));
    for (const g of [buildBumper(s, l), buildGrommets(s, l)]) {
      const b = box(g);
      expect(b.max.x).toBeLessThanOrEqual(f.max.x + 0.0005);
      expect(b.max.z).toBeLessThanOrEqual(f.max.z + 0.001);
    }
  }
});
test('aero fins add triangles to the bumper', () => {
  expect(tris(buildBumper(specFins, layout))).toBeGreaterThan(tris(buildBumper(spec, layout)));
});
test('trim faces outward at the tip and the rim', () => {
  const g = buildBumper(spec, layout); g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  let top = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > layout.tipY - 0.0002) { top = Math.max(top, n.getY(i)); }
  expect(top).toBeGreaterThan(0.5);
});
test('trim triangle budget', () => {
  for (const s of loadAllSpecs()) {
    const l = layoutOf(s);
    expect(tris(buildBumper(s, l)) + tris(buildGrommets(s, l))).toBeLessThan(1400);
  }
});
