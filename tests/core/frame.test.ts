import { test, expect } from 'bun:test';
import type * as THREE from 'three';
import { armRings, beamThicknessAt, BRIDGE_U, bridgeRings, buildFrame, findJunction, frameContext, hoopRings, U_JUNCTION, U_SHAFT } from '../../src/core/frame';
import { computeLayout } from '../../src/core/layout';
import { headOutline } from '../../src/core/outline';
import { HOOP_RADIAL } from '../../src/core/section';
import { loadAllSpecs, type RacquetSpec } from '../../src/core/spec';
import { makeSpec } from '../fixtures';

const spec = makeSpec({ specs: { beamMm: [23, 26, 22] } });
const layoutOf = (s: RacquetSpec) => computeLayout(s, HOOP_RADIAL[s.geometry.beam.profile]);
const layout = layoutOf(spec);
const frameOf = (s: RacquetSpec) => buildFrame(s, layoutOf(s));
const zExtent = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!.max.z - g.boundingBox!.min.z; };
const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;

const thin = frameOf(makeSpec({ specs: { beamMm: [21, 21, 21] }, geometry: { beam: { profile: 'box' } } }));
const thick = frameOf(makeSpec({ specs: { beamMm: [23, 26, 23] }, geometry: { beam: { profile: 'ellipse' } } }));

test('beam thickness interpolates tip/mid/shaft', () => {
  expect(beamThicknessAt(spec, 1)).toBeCloseTo(0.023, 4);
  expect(beamThicknessAt(spec, 0.65)).toBeCloseTo(0.026, 4);
  expect(beamThicknessAt(spec, 0)).toBeCloseTo(0.022, 4);
});
test('beam thickness never leaves the range of the published values', () => {
  for (let i = 0; i <= 100; i++) {
    const t = beamThicknessAt(spec, i / 100);
    expect(t).toBeGreaterThanOrEqual(0.022 - 1e-9); expect(t).toBeLessThanOrEqual(0.026 + 1e-9);
  }
});
test('frame spans grip top to tip and is symmetric', () => {
  const g = buildFrame(spec, layout); g.computeBoundingBox(); const b = g.boundingBox!;
  expect(b.max.y).toBeCloseTo(layout.tipY, 6); expect(b.min.y).toBeCloseTo(layout.gripTopY, 3);
  expect(b.min.x).toBeCloseTo(-b.max.x, 4); expect(b.min.z).toBeCloseTo(-b.max.z, 4);
});
test('frame z extent equals the thickest beam value', () => {
  const g = buildFrame(spec, layout); g.computeBoundingBox();
  expect(g.boundingBox!.max.z * 2).toBeCloseTo(0.026, 3);
});
test('frame has a u attribute within 0..1 and under 9000 triangles', () => {
  const g = buildFrame(spec, layout); const u = g.getAttribute('u');
  expect(u.count).toBe(g.getAttribute('position').count);
  for (let i = 0; i < u.count; i++) { expect(u.getX(i)).toBeGreaterThanOrEqual(0); expect(u.getX(i)).toBeLessThanOrEqual(1); }
  expect(g.index!.count / 3).toBeLessThan(9000);
});
test('a thin box beam and a thick ellipse beam produce different silhouettes side-on', () => {
  // blade-like [21,21,21] box vs pure-drive-like [23,26,23] ellipse: compare max z
  expect(zExtent(thick)).toBeGreaterThan(zExtent(thin) * 1.2);
});
test('u runs from the shaft (0) to the tip (1)', () => {
  const g = buildFrame(spec, layout), pos = g.getAttribute('position'), u = g.getAttribute('u');
  let atTip = 0, atGrip = 1;
  for (let i = 0; i < u.count; i++) {
    if (pos.getY(i) > layout.tipY - 0.002) atTip = Math.max(atTip, u.getX(i));
    if (pos.getY(i) < layout.gripTopY + 0.002) atGrip = Math.min(atGrip, u.getX(i));
  }
  expect(atTip).toBeCloseTo(1, 2); expect(atGrip).toBeCloseTo(0, 2);
});
test('the hoop leaves the string bed clear', () => {
  const loop = headOutline(spec.geometry.head.shape, spec.specs.headSizeSqIn, spec.geometry.head.aspect, 256)
    .map(p => ({ x: p.x, y: p.y + layout.headCenterY }));
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i], b = loop[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const dist = (x: number, y: number) => Math.min(...loop.map((p, i) => {
    const q = loop[(i + 1) % loop.length], dx = q.x - p.x, dy = q.y - p.y;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - p.x - t * dx, y - p.y - t * dy);
  }));
  const pos = buildFrame(spec, layout).getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (y < layout.bridgeY + 0.02) continue; // the flat-bridge variant may sit just above the outline bottom
    if (inside(x, y)) expect(dist(x, y)).toBeLessThan(0.0005);
  }
});
test('throat style and bridge style change the geometry', () => {
  const posOf = (s: RacquetSpec) => Array.from(frameOf(s).getAttribute('position').array as Float32Array);
  const v = posOf(makeSpec({ geometry: { throat: { style: 'open-v', bridge: 'curved' } } }));
  const u = posOf(makeSpec({ geometry: { throat: { style: 'open-u', bridge: 'curved' } } }));
  const f = posOf(makeSpec({ geometry: { throat: { style: 'open-v', bridge: 'flat' } } }));
  expect(u).not.toEqual(v); expect(f).not.toEqual(v);
});
test('tapered-box is narrower than box at the throat', () => {
  const widthAt = (g: THREE.BufferGeometry, y: number) => {
    const p = g.getAttribute('position'); let w = 0;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - y) < 0.004) w = Math.max(w, p.getX(i));
    return w;
  };
  const box = frameOf(makeSpec({ geometry: { beam: { profile: 'box' } } }));
  const tapered = frameOf(makeSpec({ geometry: { beam: { profile: 'tapered-box' } } }));
  const y = layout.gripTopY + 0.001; // the bottom shaft ring
  expect(widthAt(tapered, y)).toBeLessThan(widthAt(box, y));
});
test('every real spec builds a finite, budgeted, deterministic frame', () => {
  for (const s of loadAllSpecs()) {
    const a = frameOf(s), b = frameOf(s), l = layoutOf(s);
    const pa = a.getAttribute('position').array, pb = b.getAttribute('position').array;
    expect(Array.from(pa)).toEqual(Array.from(pb));
    for (let i = 0; i < pa.length; i++) expect(Number.isFinite(pa[i])).toBe(true);
    expect(tris(a)).toBeLessThan(5000);
    a.computeBoundingBox();
    expect(a.boundingBox!.max.y).toBeCloseTo(l.tipY, 6);
    expect(a.boundingBox!.max.z * 2).toBeCloseTo(Math.max(...s.specs.beamMm) / 1000, 3);
  }
});
test('extreme but valid specs still build clean frames', () => {
  const extremes = [
    makeSpec({ specs: { headSizeSqIn: 85, lengthIn: 26, beamMm: [14, 14, 14] }, geometry: { head: { shape: 'teardrop', aspect: 1.45 }, throat: { style: 'open-u', bridge: 'flat' } } }),
    makeSpec({ specs: { headSizeSqIn: 115, lengthIn: 29, beamMm: [32, 32, 32] }, geometry: { head: { shape: 'isometric', aspect: 1.2 }, beam: { profile: 'aero' } } }),
    makeSpec({ specs: { headSizeSqIn: 115, lengthIn: 26 }, geometry: { head: { shape: 'oval', aspect: 1.45 }, beam: { profile: 'tapered-box' }, throat: { style: 'open-u', bridge: 'curved' } } }),
  ];
  for (const s of extremes) {
    const g = frameOf(s), l = layoutOf(s), p = g.getAttribute('position').array, n = g.getAttribute('normal').array;
    for (let i = 0; i < p.length; i++) { expect(Number.isFinite(p[i])).toBe(true); expect(Number.isFinite(n[i])).toBe(true); }
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(l.tipY, 6); expect(g.boundingBox!.min.y).toBeCloseTo(l.gripTopY, 3);
  }
});
test('normals face outward', () => {
  const g = buildFrame(spec, layout), p = g.getAttribute('position'), n = g.getAttribute('normal');
  g.computeBoundingBox(); const b = g.boundingBox!;
  let checked = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > b.max.y - 1e-4) { expect(n.getY(i)).toBeGreaterThan(0.5); checked++; }
    if (p.getZ(i) > b.max.z - 1e-4) { expect(n.getZ(i)).toBeGreaterThan(0.5); checked++; }
    if (p.getX(i) > b.max.x - 1e-4) { expect(n.getX(i)).toBeGreaterThan(0.5); checked++; }
  }
  expect(checked).toBeGreaterThan(3);
});
test('mirrored vertices share u', () => {
  for (const s of [spec, makeSpec({ geometry: { beam: { profile: 'tapered-box' }, throat: { style: 'open-u', bridge: 'flat' } } })]) {
    const g = frameOf(s), p = g.getAttribute('position'), u = g.getAttribute('u');
    const key = (x: number, y: number, z: number) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;
    const uAt = new Map<string, number>();
    for (let i = 0; i < p.count; i++) uAt.set(key(p.getX(i), p.getY(i), p.getZ(i)), u.getX(i));
    let pairs = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) < 1e-6) continue;
      const m = uAt.get(key(-p.getX(i), p.getY(i), p.getZ(i)));
      expect(m).toBeDefined(); expect(m!).toBeCloseTo(u.getX(i), 6); pairs++;
    }
    expect(pairs).toBeGreaterThan(1000);
  }
});
test('junction rings carry U_JUNCTION, arms run down to U_SHAFT, the bridge carries BRIDGE_U', () => {
  for (const s of [spec, makeSpec({ geometry: { throat: { style: 'open-u', bridge: 'flat' } } })]) {
    const ctx = frameContext(s, layoutOf(s)), fJ = findJunction(ctx), hoop = hoopRings(ctx, fJ);
    expect(hoop[0].u).toBeCloseTo(1, 9);
    expect(hoop[hoop.length - 1].u).toBeCloseTo(U_JUNCTION, 9);
    const arm = armRings(ctx, hoop[hoop.length - 1]);
    expect(arm[0].u).toBeLessThan(U_JUNCTION); expect(arm[arm.length - 1].u).toBeCloseTo(U_SHAFT, 9);
    const bridge = bridgeRings(ctx, fJ);
    for (const r of bridge) expect(r.u).toBe(BRIDGE_U);
    // the bridge starts and ends at the junctions
    expect(bridge[0].c.x).toBeCloseTo(hoop[hoop.length - 1].c.x, 3); expect(bridge[bridge.length - 1].c.x).toBeCloseTo(-bridge[0].c.x, 9);
  }
});
