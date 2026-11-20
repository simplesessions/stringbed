import { test, expect } from 'bun:test';
import { beamSection, HOOP_RADIAL } from '../../src/core/section';
import { polygonArea } from '../../src/core/outline';

const PROFILES = ['box', 'ellipse', 'aero', 'tapered-box'] as const;

test('section extents match inputs', () => {
  for (const p of PROFILES) {
    const s = beamSection(p, 0.026, 0.011);
    expect(Math.max(...s.map(v => v.y)) - Math.min(...s.map(v => v.y))).toBeCloseTo(0.026, 4);
  }
});
test('section radial extent matches input and the section is centred', () => {
  for (const p of PROFILES) {
    const s = beamSection(p, 0.026, 0.011);
    expect(Math.max(...s.map(v => v.x))).toBeCloseTo(0.0055, 5);
    expect(Math.min(...s.map(v => v.x))).toBeCloseTo(-0.0055, 5);
  }
});
test('sections are counter-clockwise', () => {
  for (const p of PROFILES) {
    const s = beamSection(p, 0.024, 0.011);
    let signed = 0;
    for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; signed += a.x * b.y - b.x * a.y; }
    expect(signed).toBeGreaterThan(0);
  }
});
test('box section is fuller than ellipse at the corners', () => {
  expect(polygonArea(beamSection('box', 0.021, 0.011))).toBeGreaterThan(polygonArea(beamSection('ellipse', 0.021, 0.011)) * 1.1);
});
test('aero section is pinched: slimmer than the ellipse near the faces', () => {
  const widthNear = (s: { x: number; y: number }[], z: number) => Math.max(...s.filter(v => Math.abs(v.y) >= z).map(v => Math.abs(v.x)));
  const aero = beamSection('aero', 0.024, 0.013), ell = beamSection('ellipse', 0.024, 0.013);
  expect(widthNear(aero, 0.010)).toBeLessThan(widthNear(ell, 0.010));
});
test('hoop radial values are in range and aero is the widest', () => {
  for (const p of PROFILES) { expect(HOOP_RADIAL[p]).toBeGreaterThanOrEqual(0.010); expect(HOOP_RADIAL[p]).toBeLessThanOrEqual(0.013); }
  expect(HOOP_RADIAL.aero).toBeGreaterThan(HOOP_RADIAL.ellipse);
});
