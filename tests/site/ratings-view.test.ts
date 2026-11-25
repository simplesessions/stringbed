import { expect, test } from 'bun:test';
import { differences, inWords, topRatings } from '../../site/src/ratings-view';

const keys = ['power', 'spin', 'feel'] as const;
const label = { power: 'Power', spin: 'Spin', feel: 'Feel' };

test('the top ratings are every key at the highest mark, in key order', () => {
  expect(topRatings(keys, { power: 2, spin: 5, feel: 5 })).toEqual(['spin', 'feel']);
  expect(topRatings(keys, { power: 3, spin: 3, feel: 3 })).toEqual(['power', 'spin', 'feel']);
});

test('differences read from the rival: higher and lower, equal in neither', () => {
  expect(differences(keys, { power: 2, spin: 4, feel: 3 }, { power: 4, spin: 4, feel: 1 })).toEqual({ higher: ['power'], lower: ['feel'] });
});

test('keys read as a phrase', () => {
  expect(inWords([], label)).toBe('');
  expect(inWords(['spin'], label)).toBe('spin');
  expect(inWords(['power', 'spin', 'feel'], label)).toBe('power, spin and feel');
});
