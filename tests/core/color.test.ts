import { hexToLinear } from '../../src/core/color';

test('hexToLinear converts sRGB to linear exactly at the ends', () => {
  expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
  expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
  expect(hexToLinear('#ff0000')).toEqual([1, 0, 0]);
});
test('hexToLinear applies the sRGB curve', () => {
  expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2158605, 5);
  expect(hexToLinear('#0a0a0a')[1]).toBeCloseTo(10 / 255 / 12.92, 6);
});
