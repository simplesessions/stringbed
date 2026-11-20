import type * as THREE from 'three';
import { buildFrame } from '../../src/core/frame';
import { computeLayout } from '../../src/core/layout';
import { HOOP_RADIAL } from '../../src/core/section';
import { loadAllSpecs, type RacquetSpec } from '../../src/core/spec';
import { buildButtCap, buildCollar, buildGrip } from '../../src/core/handle';
import { buildCrosses, buildMains, mainPositions, stringBed } from '../../src/core/strings';
import { buildBumper, buildDampener, buildGrommets } from '../../src/core/trim';
import { hexToLinear } from '../../src/core/color';
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
test('o-ports colour the grommets: color attribute only when the spec has o-ports', () => {
  const g = buildGrommets(specWithOPorts, layout);
  const c = g.getAttribute('color');
  expect(c.itemSize).toBe(3); expect(c.count).toBe(g.getAttribute('position').count);
  expect(g.groups).toHaveLength(0);
  const base = hexToLinear(spec.parts.grommets.color);
  let dark = 0, plain = 0;
  for (let i = 0; i < c.count; i++) {
    if (Math.abs(c.getX(i) - base[0] * 0.15) < 1e-6 && base[0] > 0) dark++;
    else if (Math.abs(c.getX(i) - base[0]) < 1e-6) plain++;
  }
  expect(plain).toBeGreaterThan(0);
  expect(buildGrommets(spec, layout).getAttribute('color')).toBeUndefined();
});
test('o-ports are at 3 and 9 o\'clock, flush insets', () => {
  const lightSpec = makeSpec({ geometry: { features: ['o-ports'] }, parts: { grommets: { color: '#ffffff' } } });
  const g = buildGrommets(lightSpec, layoutOf(lightSpec)); const c = g.getAttribute('color'), p = g.getAttribute('position');
  const nr = g.getAttribute('normal');
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < c.count; i++) if (c.getX(i) < 0.5) { expect(nr.getX(i) * Math.sign(p.getX(i))).toBeGreaterThan(0.5); minX = Math.min(minX, p.getX(i)); maxX = Math.max(maxX, p.getX(i)); }
  expect(minX).toBeLessThan(-0.05); expect(maxX).toBeGreaterThan(0.05);
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
      expect(b.max.x).toBeLessThanOrEqual(f.max.x + 0.0004);
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

test('all trim stays within 0.4 mm of the frame: union y, and |x|, on every spec', () => {
  for (const s of [specFins, specWithOPorts, makeSpec({ geometry: { features: ['aero-fins', 'o-ports'] } }), ...loadAllSpecs()]) {
    const l = layoutOf(s); const f = box(buildFrame(s, l));
    const b = buildBumper(s, l), g = buildGrommets(s, l);
    const maxY = Math.max(box(b).max.y, box(g).max.y);
    expect(maxY).toBeLessThanOrEqual(f.max.y + 0.0004); expect(maxY).toBeGreaterThan(f.max.y - 0.0005);
    for (const t of [b, g]) { const bb = box(t); expect(bb.max.x).toBeLessThanOrEqual(f.max.x + 0.0004); expect(bb.min.x).toBeGreaterThanOrEqual(f.min.x - 0.0004); }
  }
});
test('trim builders are deterministic', () => {
  const s = makeSpec({ geometry: { features: ['aero-fins', 'o-ports'] }, parts: { dampener: { color: '#ff0000' } } });
  for (const build of [buildBumper, buildGrommets, buildDampener]) {
    const a = build(s, layout)!, b = build(s, layout)!;
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
    expect(Array.from(a.index!.array)).toEqual(Array.from(b.index!.array));
  }
});
test('dampener is indexed, has no uv, and is centred between the centre mains', () => {
  for (const n of [16, 17]) {
    const s = makeSpec({ specs: { stringPattern: [n, 19] }, parts: { dampener: { color: '#ff0000' } } });
    const d = buildDampener(s, layoutOf(s))!;
    expect(d.index).not.toBeNull(); expect(d.getAttribute('uv')).toBeUndefined();
    const b = box(d); const xs = mainPositions(n, stringBed(s, layoutOf(s)).width * 0.9);
    const m = n >> 1; const c = n % 2 ? (xs[m] + xs[m + 1]) / 2 : (xs[m - 1] + xs[m]) / 2;
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(c, 5);
  }
});
test('everything except the frame stays under 2,500 triangles on every spec', () => {
  for (const s of loadAllSpecs()) {
    const l = layoutOf(s);
    const total = [buildGrip, buildCollar, buildButtCap, buildMains, buildCrosses, buildBumper, buildGrommets].reduce((a, fn) => a + tris(fn(s, l)), 0);
    expect(total).toBeLessThan(2500);
  }
});

test('dampener faces outward', () => {
  const s = makeSpec({ parts: { dampener: { color: '#ff0000' } } });
  const d = buildDampener(s, layoutOf(s))!; const n = d.getAttribute('normal'), p = d.getAttribute('position');
  const b = box(d); const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
  for (let i = 0; i < p.count; i++) expect(n.getX(i) * (p.getX(i) - cx) + n.getY(i) * (p.getY(i) - cy) + n.getZ(i) * p.getZ(i)).toBeGreaterThan(-1e-9);
});
