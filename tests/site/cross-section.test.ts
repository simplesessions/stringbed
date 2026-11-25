import { expect, test } from 'bun:test';
import { PX_PER_MM, sectionCorners } from '../../site/src/cross-section';

test('a shaped section has its corners on the gauge circle, evenly spread, at one scale', () => {
  for (const sides of [3, 4, 5, 6, 8, 12]) for (const gauge of [1.1, 1.25, 1.4]) {
    const corners = sectionCorners(sides, gauge);
    expect(corners).toHaveLength(sides);
    for (const [x, y] of corners) expect(Math.hypot(x, y)).toBeCloseTo((gauge / 2) * PX_PER_MM, 6);
    const side = (i: number) => Math.hypot(corners[i][0] - corners[(i + 1) % sides][0], corners[i][1] - corners[(i + 1) % sides][1]);
    for (let i = 1; i < sides; i++) expect(side(i)).toBeCloseTo(side(0), 6);
  }
});

test('it lies on a flat face, as a string lies on a table', () => {
  for (const sides of [3, 4, 5, 6, 7, 8]) {
    const lowest = Math.max(...sectionCorners(sides, 1.25).map(([, y]) => y));
    expect(sectionCorners(sides, 1.25).filter(([, y]) => Math.abs(y - lowest) < 1e-6)).toHaveLength(2);
  }
});

test('a round section has no corners', () => {
  expect(sectionCorners(0, 1.25)).toEqual([]);
});
