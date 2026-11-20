import { test, expect } from 'bun:test';
import { inToM, mmToM, sqInToSqM } from '../../src/core/units';
test('unit conversions', () => {
  expect(inToM(27)).toBeCloseTo(0.6858, 6);
  expect(mmToM(26)).toBeCloseTo(0.026, 9);
  expect(sqInToSqM(100)).toBeCloseTo(0.064516, 6);
});
