import { test, expect } from 'bun:test';
import { computeLayout } from '../../src/core/layout';
import { makeSpec } from '../fixtures';

const spec27 = makeSpec();

test('layout: 27 in racquet', () => {
  const l = computeLayout(spec27, 0.011);
  expect(l.tipY).toBeCloseTo(0.6858, 4); expect(l.gripTopY).toBeCloseTo(0.178, 3);
  expect(l.bridgeY).toBeGreaterThan(l.gripTopY + 0.08);
});
test('layout: extra length goes below the head', () => {
  const a = computeLayout(spec27, 0.011), b = computeLayout({ ...spec27, specs: { ...spec27.specs, lengthIn: 27.5 } }, 0.011);
  expect(b.tipY).toBeCloseTo(0.6985, 4);
  expect(b.tipY - b.bridgeY).toBeCloseTo(a.tipY - a.bridgeY, 5);
});
