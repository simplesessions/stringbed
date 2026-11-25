import { describe, expect, test } from 'bun:test';
import { addressWriter, dresser, lastWord, strummer, until } from '../../site/src/build-timing';
import { fakeClock } from './fake-clock';

describe('the address is written sparingly', () => {
  test('the first change is written at once, the rest at most every 400 ms, and the last one always', () => {
    const c = fakeClock();
    const written: Array<[number, number]> = [];
    let value = 0;
    const w = addressWriter(() => void written.push([c.now(), value]), 400, c);
    for (let i = 0; i < 1900; i++) { // a 30 s drag, an event every 16 ms
      value = i;
      w.touch();
      c.tick(16);
    }
    c.tick(1000);
    expect(written[0]).toEqual([0, 0]);
    expect(written.at(-1)![1]).toBe(1899);
    expect(written.length).toBeLessThan(100);
    for (let i = 1; i < written.length; i++) expect(written[i][0] - written[i - 1][0]).toBeGreaterThanOrEqual(400);
    const n = written.length;
    c.tick(5000);
    expect(written).toHaveLength(n); // at rest, nothing more
  });
  test('flush writes what is pending now and nothing when there is none; cancel drops it', () => {
    const c = fakeClock();
    let n = 0;
    const w = addressWriter(() => void n++, 400, c);
    w.flush();
    expect(n).toBe(0);
    w.touch();
    w.touch();
    expect(n).toBe(1);
    w.flush();
    expect(n).toBe(2);
    c.tick(1000);
    expect(n).toBe(2);
    w.touch();
    w.touch();
    w.cancel();
    c.tick(1000);
    expect(n).toBe(3);
  });
  test('a write that throws (a browser that has had enough) is not lost and does not throw', () => {
    const c = fakeClock();
    let fail = true;
    let n = 0;
    const w = addressWriter(() => { if (fail) throw new Error('SecurityError'); n++; }, 400, c);
    expect(() => w.touch()).not.toThrow();
    fail = false;
    c.tick(60_000);
    expect(n).toBe(1);
  });
});

describe('a clock that stops with the page', () => {
  test('nothing runs after it stops: not what was waiting, not what is asked for later', () => {
    const c = fakeClock();
    const life = new AbortController();
    const page = until(life.signal, c);
    let n = 0;
    page.later(() => n++, 100);
    page.frame(() => n++);
    page.later(() => n++, 10);
    c.tick(50);
    expect(n).toBe(2);
    life.abort();
    expect(c.waiting()).toBe(0);
    page.later(() => n++, 10);
    page.frame(() => n++);
    c.tick(1000);
    expect(n).toBe(2);
    expect(() => page.later(() => {}, 1)()).not.toThrow();
  });
  test('called off before it runs', () => {
    const c = fakeClock();
    const page = until(new AbortController().signal, c);
    let n = 0;
    page.later(() => n++, 10)();
    c.tick(100);
    expect(n).toBe(0);
  });
});

describe('dressing', () => {
  test('many changes in a frame are one dress, and the last always lands', () => {
    const c = fakeClock();
    let value = 0;
    const worn: number[] = [];
    const d = dresser(() => void worn.push(value), c);
    for (let i = 1; i <= 100; i++) { value = i; d.soon(); }
    expect(worn).toEqual([]);
    c.tick(16);
    expect(worn).toEqual([100]);
    c.tick(1000);
    expect(worn).toEqual([100]);
  });
  test('a slow dress leaves as long again free, so a drag is never all dressing', () => {
    const c = fakeClock();
    let value = 0;
    const worn: Array<[number, number]> = [];
    const d = dresser(() => { worn.push([c.now(), value]); c.spend(50); }, c);
    for (let i = 0; i < 200; i++) { value = i; d.soon(); c.tick(5); }
    c.tick(1000);
    expect(worn.at(-1)![1]).toBe(199);
    for (let i = 1; i < worn.length; i++) expect(worn[i][0] - worn[i - 1][0]).toBeGreaterThanOrEqual(100);
  });
  test('never after its clock has stopped, even asked again', () => {
    const c = fakeClock();
    const life = new AbortController();
    let n = 0;
    const d = dresser(() => void n++, until(life.signal, c));
    d.soon();
    life.abort();
    d.soon();
    c.tick(1000);
    expect(n).toBe(0);
  });
});

describe('the last word', () => {
  test('waits for quiet, says it once, and can be called off', () => {
    const c = fakeClock();
    let n = 0;
    const w = lastWord(() => void n++, c);
    for (let i = 0; i < 10; i++) { w.soon(100); c.tick(50); }
    expect(n).toBe(0);
    c.tick(100);
    expect(n).toBe(1);
    w.soon(100);
    w.cancel();
    c.tick(1000);
    expect(n).toBe(1);
  });
});

describe('strumming', () => {
  const heard = () => {
    const c = fakeClock();
    const sounds: Array<[number, string]> = [];
    const life = new AbortController();
    const s = strummer((muted) => void sounds.push([c.now(), muted ? 'muted' : 'pluck']), 90, until(life.signal, c));
    return { c, s, sounds, life };
  };
  test('a restring is one muted pluck, almost at once', () => {
    const { c, s, sounds } = heard();
    s.restrung();
    c.tick(2000);
    expect(sounds).toEqual([[90, 'muted']]);
  });
  test('an arrow key held down on the list: one muted pluck ends it', () => {
    const { c, s, sounds } = heard();
    for (let i = 0; i < 40; i++) { s.restrung(); c.tick(33); }
    c.tick(2000);
    expect(sounds.map(([, x]) => x)).toEqual(['muted']);
  });
  test('tension after a restring rings', () => {
    const { c, s, sounds } = heard();
    s.restrung();
    s.soon(180);
    c.tick(2000);
    expect(sounds).toEqual([[180, 'pluck']]);
  });
  test('a dragged slider plucks once, after it settles', () => {
    const { c, s, sounds } = heard();
    for (let i = 0; i < 100; i++) { s.soon(540); c.tick(16); }
    s.soon(180); // let go
    c.tick(179);
    expect(sounds).toEqual([]);
    c.tick(1);
    expect(sounds).toEqual([[1780, 'pluck']]);
    c.tick(2000);
    expect(sounds).toHaveLength(1);
  });
  test('an address from elsewhere calls a waiting pluck off; leaving does too', () => {
    const { c, s, sounds, life } = heard();
    s.soon(100);
    s.cancel();
    c.tick(1000);
    s.soon(100);
    life.abort();
    s.soon(100);
    c.tick(1000);
    expect(sounds).toEqual([]);
  });
});
