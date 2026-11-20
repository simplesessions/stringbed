import { test, expect } from 'bun:test';
import { headOutline, outlineHalfWidthAt, polygonArea } from '../../src/core/outline';
import { sqInToSqM } from '../../src/core/units';

test('outline area matches head size for every shape', () => {
  for (const shape of ['oval', 'isometric', 'teardrop'] as const) {
    const loop = headOutline(shape, 100, 1.3, 128);
    expect(polygonArea(loop)).toBeCloseTo(sqInToSqM(100), 4);
  }
});
test('outline is symmetric and starts at the tip', () => {
  const loop = headOutline('oval', 98, 1.3, 128);
  expect(loop[0].x).toBeCloseTo(0, 6);
  expect(loop[0].y).toBeGreaterThan(0);
  for (let i = 1; i < 64; i++) { expect(loop[i].x).toBeCloseTo(-loop[128 - i].x, 6); expect(loop[i].y).toBeCloseTo(loop[128 - i].y, 6); }
});
test('aspect ratio is honoured', () => {
  const loop = headOutline('oval', 100, 1.35, 256);
  const xs = loop.map(p => p.x), ys = loop.map(p => p.y);
  expect((Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs))).toBeCloseTo(1.35, 2);
});
test('isometric is visibly squarer at the top than oval', () => {
  const iso = headOutline('isometric', 100, 1.3, 256), oval = headOutline('oval', 100, 1.3, 256);
  const y = 0.75 * Math.max(...oval.map(p => p.y));
  expect(outlineHalfWidthAt(iso, y)).toBeGreaterThan(outlineHalfWidthAt(oval, y) * 1.06);
});
test('goes clockwise from the tip (towards +x first)', () => {
  const loop = headOutline('oval', 100, 1.3, 128);
  expect(loop[1].x).toBeGreaterThan(0);
});
test('points are evenly spaced by arc length', () => {
  const loop = headOutline('isometric', 100, 1.3, 128);
  const d = loop.map((p, i) => Math.hypot(p.x - loop[(i + 1) % 128].x, p.y - loop[(i + 1) % 128].y));
  expect(Math.max(...d) / Math.min(...d)).toBeLessThan(1.05);
});
test('isometric narrows toward the throat: squared shoulders over a tapering base', () => {
  const iso = headOutline('isometric', 100, 1.3, 256), oval = headOutline('oval', 100, 1.3, 256);
  const top = Math.max(...oval.map((p) => p.y));
  expect(outlineHalfWidthAt(iso, 0.9 * top)).toBeGreaterThan(outlineHalfWidthAt(oval, 0.9 * top) * 1.08);
  expect(outlineHalfWidthAt(iso, -0.75 * top)).toBeLessThan(outlineHalfWidthAt(oval, -0.75 * top) * 0.97);
});
