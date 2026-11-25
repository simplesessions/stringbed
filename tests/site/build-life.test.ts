import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StringSpec } from '../../src/string-spec';
import { buildLife, carry } from '../../site/src/build-life';
import { chooseString, emptyBuild, formatBuild, parseBuild } from '../../site/src/build-state';

const strings: StringSpec[] = JSON.parse(readFileSync(join(import.meta.dir, '../../assets/strings.json'), 'utf8')).strings;
const FULL = 'v=1&s=luxilon-alu-power.silver.125~babolat-touch-vs.natural.130&t=52.5~50&l=h90m.40.2~l150m.60.1&g=white&d=red&w=305&b=320';

describe('reading an address', () => {
  test('before the strings are here, choices are kept; once they are, they are checked against the address as it came', () => {
    const l = buildLife();
    l.read('s=nope.x.1~luxilon-alu-power.silver.125&t=abc&d=red');
    expect(l.build.mains).not.toBeNull();
    expect(l.dropped).toEqual(['tension']);
    l.check(strings);
    expect(l.build.mains).toBeNull();
    expect(l.build.dampener).toBe('red');
    // In the address's own words ("nope.x.1", not the gauge it was clamped to), and nothing named twice.
    expect(l.dropped).toEqual(parseBuild('s=nope.x.1~luxilon-alu-power.silver.125&t=abc&d=red', strings).dropped);
    expect(l.dropped.filter((x) => x === 'tension')).toHaveLength(1);
    expect(l.dropped).toContain('string nope.x.1');
  });
  test('changed before the strings arrive: the change is kept, the rest is checked, and what was dropped already is still named', () => {
    const l = buildLife();
    l.read('s=nope.x.125&t=abc');
    l.change({ overgrip: 'white' });
    l.check(strings);
    expect(l.build).toEqual({ ...emptyBuild(), overgrip: 'white' });
    expect(l.dropped).toEqual(['tension', 'string nope.x.125']);
  });
  test('a full address comes through whole, strings before or after', () => {
    const early = buildLife();
    early.check(strings);
    early.read(FULL);
    const late = buildLife();
    late.read(FULL);
    late.check(strings);
    for (const l of [early, late]) {
      expect(formatBuild(l.build)).toBe(FULL);
      expect(l.dropped).toEqual([]);
    }
  });
  test('another address replaces everything, the undo too', () => {
    const l = buildLife();
    l.check(strings);
    l.read(FULL);
    l.startOver();
    expect(l.canPutBack).toBe(true);
    l.read('t=60&bad&l=zzz');
    expect(l.canPutBack).toBe(false);
    expect(l.build).toEqual({ ...emptyBuild(), tensionLb: 60 });
    expect(l.dropped).toEqual(['tape zzz']);
    l.read('');
    expect(l.dropped).toEqual([]);
  });
});

describe('changing it', () => {
  test('a change replaces only what it names', () => {
    const l = buildLife();
    l.read(FULL);
    const before = l.build;
    expect(l.change({ tensionLb: 60 })).toBe(true);
    expect(l.build).toEqual({ ...before, tensionLb: 60 });
  });
  test('start over, then put it back; anything changed in between and there is nothing to put back', () => {
    const l = buildLife();
    l.read(FULL);
    const before = l.build;
    expect(l.startOver()).toBe('cleared');
    expect(l.build).toEqual(emptyBuild());
    expect(l.startOver()).toBe('back');
    expect(l.build).toEqual(before);
    expect(l.canPutBack).toBe(false);
    l.startOver();
    l.change({ dampener: 'blue' });
    expect(l.canPutBack).toBe(false);
    l.startOver();
    expect(l.build).toEqual(emptyBuild());
    l.startOver();
    expect(l.build).toEqual({ ...emptyBuild(), dampener: 'blue' });
  });
});

describe('leaving', () => {
  test('nothing changes after it: not a field that blurs, not strings that arrive, not an address', () => {
    const l = buildLife();
    l.read(FULL);
    const before = l.build;
    l.leave();
    expect(l.left).toBe(true);
    expect(l.change({ yours: { g: 290 } })).toBe(false);
    expect(l.startOver()).toBeNull();
    l.check(strings);
    l.read('t=60');
    expect(l.build).toEqual(before);
  });
});

describe('carrying a build to another racquet', () => {
  const build = { ...emptyBuild(), mains: chooseString(strings[0]), tensionLb: 55, yours: { g: 290, balanceMm: 325 }, overgrip: 'red' };
  test('everything but your own measurements, and it says so', () => {
    const c = carry(build, 'Pure Drive 100');
    expect(parseBuild(c.query, strings).build).toEqual({ ...build, yours: {} });
    expect(c.notice).toBe('Your measurements were for the Pure Drive 100, so they were cleared.');
  });
  test('half a measurement counts; none says nothing', () => {
    expect(carry({ ...build, yours: { g: 290 } }, 'X').notice).not.toBe('');
    expect(carry({ ...build, yours: {} }, 'X')).toEqual({ query: formatBuild({ ...build, yours: {} }), notice: '' });
  });
});
