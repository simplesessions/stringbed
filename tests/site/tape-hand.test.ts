import { describe, expect, test } from 'bun:test';
import type { TapePiece } from '../../src/tape';
import { aimNext, hand, newHand, ringSearch, type Effect, type Hand, type HandEvent, type Spot } from '../../site/src/tape-hand';
import { aimStep, type Place } from '../../site/src/build-view';

const piece = (zone: TapePiece['zone'], at: number, more: Partial<TapePiece> = {}): TapePiece => ({ zone, at, mirrored: true, lengthMm: 80, layers: 1, ...more });
const spot = (at: number, fits = true, zone: TapePiece['zone'] = 'h'): Spot => ({ piece: piece(zone, at), fits });
const down = (id: number, more: Partial<Extract<HandEvent, { type: 'down' }>> = {}): HandEvent => ({ type: 'down', id, pointer: 'touch', button: 0, x: 100, y: 100, at: 0, on: null, ...more });

/** Feed it events and collect what it asks for. */
function play(events: HandEvent[], start: Hand = { ...newHand(), taping: true }) {
  let state = start;
  const effects: Effect[] = [];
  for (const e of events) {
    const next = hand(state, e);
    state = next.state;
    effects.push(...next.effects);
  }
  return { state, effects, kinds: effects.map((e) => e.do) };
}

describe('a press on the frame', () => {
  test('aims, slides, and sticks where it is let go', () => {
    const { effects, state } = play([down(1, { on: { grab: null, spot: spot(90) } }), { type: 'slide', id: 1, spot: spot(100) }, { type: 'up', id: 1, x: 0, y: 0, at: 900, onModel: true }]);
    expect(effects).toEqual([{ do: 'claim', id: 1 }, { do: 'aim', piece: piece('h', 90) }, { do: 'aim', piece: piece('h', 100) }, { do: 'aim', piece: null }, { do: 'stick', piece: piece('h', 100) }]);
    expect(state.held).toBeNull();
    expect(state.down).toEqual([]);
  });
  test('slid off the frame it sticks nothing; slid back on, it sticks there', () => {
    const press = down(1, { on: { grab: null, spot: spot(90) } });
    const up: HandEvent = { type: 'up', id: 1, x: 0, y: 0, at: 900, onModel: true };
    const off = play([press, { type: 'slide', id: 1, spot: null }, up]);
    expect(off.kinds).not.toContain('stick');
    expect(off.effects.filter((e) => e.do === 'aim').at(-1)).toEqual({ do: 'aim', piece: null });
    const back = play([press, { type: 'slide', id: 1, spot: null }, { type: 'slide', id: 1, spot: spot(120) }, up]);
    expect(back.effects.at(-1)).toEqual({ do: 'stick', piece: piece('h', 120) });
  });
  test('where there is no room it sticks nothing, even after somewhere there was', () => {
    const { kinds } = play([down(1, { on: { grab: null, spot: spot(90) } }), { type: 'slide', id: 1, spot: spot(180, false) }, { type: 'up', id: 1, x: 0, y: 0, at: 900, onModel: true }]);
    expect(kinds).not.toContain('stick');
    expect(play([down(1, { on: { grab: null, spot: spot(180, false) } }), { type: 'up', id: 1, x: 0, y: 0, at: 1, onModel: true }]).kinds).toEqual(['claim', 'aim']);
  });
  test('only while taping, only the main button, and only on the frame', () => {
    const press = down(1, { on: { grab: null, spot: spot(90) } });
    expect(play([press], newHand()).kinds).toEqual([]);
    expect(play([down(1, { pointer: 'mouse', button: 2, on: { grab: null, spot: spot(90) } })]).kinds).toEqual([]);
    expect(play([down(1)]).kinds).toEqual([]); // the wall: the camera's
  });
  test('another finger\'s moves and lifts are not this one\'s', () => {
    const { kinds, state } = play([down(1, { on: { grab: null, spot: spot(90) } }), { type: 'slide', id: 2, spot: spot(10) }, { type: 'up', id: 2, x: 0, y: 0, at: 5, onModel: true }]);
    expect(kinds).toEqual(['claim', 'aim']);
    expect(state.held?.id).toBe(1);
  });
  test('called off by the browser, nothing sticks', () => {
    const { kinds, state } = play([down(1, { on: { grab: null, spot: spot(90) } }), { type: 'cancel', id: 1 }]);
    expect(kinds).toEqual(['claim', 'aim', 'aim']);
    expect(state.held).toBeNull();
  });
});

describe('a piece that is there already', () => {
  const was = piece('h', 90);
  const take = down(1, { on: { grab: { index: 2, side: 0, piece: was }, spot: null } });
  test('is moved as it goes, and settles where it is let go', () => {
    const { effects } = play([take, { type: 'slide', id: 1, spot: spot(95) }, { type: 'up', id: 1, x: 0, y: 0, at: 900, onModel: true }]);
    expect(effects).toEqual([{ do: 'claim', id: 1 }, { do: 'aim', piece: null }, { do: 'grab', index: 2 }, { do: 'move', index: 2, place: { zone: 'h', at: 95 }, done: false }, { do: 'move', index: 2, place: { zone: 'h', at: 95 }, done: true }]);
  });
  test('taken by its mirror, it goes the other way round, and keeps its own size', () => {
    const own = piece('h', 90, { lengthMm: 40, layers: 3 });
    const { effects, state } = play([down(1, { on: { grab: { index: 0, side: 1, piece: own }, spot: null } }), { type: 'slide', id: 1, spot: spot(260) }]);
    expect(effects.at(-1)).toEqual({ do: 'move', index: 0, place: { zone: 'h', at: 100 }, done: false });
    expect(state.held?.piece).toEqual({ ...own, at: 100 });
  });
  test('off the frame or where there is no room, it stays where it last was', () => {
    const { effects } = play([take, { type: 'slide', id: 1, spot: spot(95) }, { type: 'slide', id: 1, spot: null }, { type: 'slide', id: 1, spot: spot(180, false) }, { type: 'up', id: 1, x: 0, y: 0, at: 900, onModel: true }]);
    expect(effects.filter((e) => e.do === 'move')).toEqual([{ do: 'move', index: 2, place: { zone: 'h', at: 95 }, done: false }, { do: 'move', index: 2, place: { zone: 'h', at: 95 }, done: true }]);
  });
  test('let go without moving, it has not moved', () => {
    expect(play([take, { type: 'up', id: 1, x: 0, y: 0, at: 5, onModel: true }]).kinds).not.toContain('move');
  });
  test('dropped (Escape, or the browser calls it off), it goes back', () => {
    for (const end of [{ type: 'drop' }, { type: 'cancel', id: 1 }] as HandEvent[]) {
      const { effects, state } = play([take, { type: 'slide', id: 1, spot: spot(95) }, end]);
      expect(effects.at(-1)).toEqual({ do: 'move', index: 2, place: { zone: 'h', at: 90 }, done: false });
      expect(state.held).toBeNull();
    }
  });
  test('forgotten (another build has taken its place), nothing is moved at all', () => {
    const { effects, state } = play([take, { type: 'slide', id: 1, spot: spot(95) }, { type: 'forget' }, { type: 'up', id: 1, x: 0, y: 0, at: 900, onModel: true }]);
    expect(effects.filter((e) => e.do === 'move')).toHaveLength(1); // the slide itself
    expect(state).toMatchObject({ held: null, tap: null, taping: false, down: [] });
  });
});

describe('a second finger', () => {
  test('takes the press back and gives both to the camera', () => {
    const { effects, state } = play([down(1, { on: { grab: null, spot: spot(90) } }), { type: 'slide', id: 1, spot: spot(100), x: 140, y: 150 }, down(2, { x: 300, y: 300, on: { grab: null, spot: spot(200) } })]);
    expect(effects.slice(-2)).toEqual([{ do: 'aim', piece: null }, { do: 'handOver', id: 1, x: 140, y: 150 }]);
    expect(state.held).toBeNull();
    const rest = play([{ type: 'up', id: 1, x: 0, y: 0, at: 90, onModel: true }, { type: 'up', id: 2, x: 0, y: 0, at: 90, onModel: true }], state);
    expect(rest.effects).toEqual([]);
    expect(rest.state.down).toEqual([]);
  });
  test('puts a piece being moved back first', () => {
    const { effects } = play([down(1, { on: { grab: { index: 0, side: 0, piece: piece('h', 90) }, spot: null } }), { type: 'slide', id: 1, spot: spot(99), x: 5, y: 6 }, down(2)]);
    expect(effects.slice(-3)).toEqual([{ do: 'aim', piece: null }, { do: 'move', index: 0, place: { zone: 'h', at: 90 }, done: false }, { do: 'handOver', id: 1, x: 5, y: 6 }]);
  });
  test('is no tap, for either', () => {
    const { kinds } = play([down(1), down(2), { type: 'up', id: 1, x: 100, y: 100, at: 50, onModel: true }, { type: 'up', id: 2, x: 100, y: 100, at: 50, onModel: true }], newHand());
    expect(kinds).toEqual([]);
  });
  test('a mouse button pressed beside another is not handed over', () => {
    const { kinds } = play([down(1, { pointer: 'mouse', on: { grab: null, spot: spot(90) } }), down(2, { pointer: 'mouse' })]);
    expect(kinds).toEqual(['claim', 'aim', 'aim']);
  });
});

describe('a tap', () => {
  const up = (more: Partial<Extract<HandEvent, { type: 'up' }>> = {}): HandEvent => ({ type: 'up', id: 1, x: 102, y: 101, at: 200, onModel: true, ...more });
  test('is short, still, and on the model, taping or not', () => {
    for (const start of [newHand(), { ...newHand(), taping: true }]) expect(play([down(1), up()], start).effects).toEqual([{ do: 'tap', x: 102, y: 101 }]);
    expect(play([down(1), up({ x: 120 })]).effects).toEqual([]);
    expect(play([down(1), up({ at: 900 })]).effects).toEqual([]);
    expect(play([down(1), up({ onModel: false })]).effects).toEqual([]);
    expect(play([down(1, { button: 2, pointer: 'mouse' }), up()]).effects).toEqual([]);
  });
  test('a press that stuck something is not also a tap', () => {
    expect(play([down(1, { on: { grab: null, spot: spot(90) } }), up()]).kinds).not.toContain('tap');
  });
});

describe('finding the frame near a press', () => {
  test('the spot itself first, then outwards, and no further than the reach', () => {
    const tried: Array<[number, number]> = [];
    const at = (x: number, y: number) => { tried.push([x, y]); return null; };
    expect(ringSearch(at, 50, 60, 24)).toBeNull();
    expect(tried[0]).toEqual([50, 60]);
    const far = tried.map(([x, y]) => Math.hypot(x - 50, y - 60));
    for (let i = 1; i < far.length; i++) expect(far[i]).toBeGreaterThanOrEqual(far[i - 1] - 1e-9);
    expect(Math.max(...far)).toBeLessThanOrEqual(24);
    expect(tried).toHaveLength(1 + 8 * 5);
  });
  test('stops at the first thing found, and the nearest of two', () => {
    let calls = 0;
    const wall = (x: number) => { calls++; return x >= 59 ? 'right' : x <= 37 ? 'left' : null; };
    expect(ringSearch(wall, 50, 0, 24)).toBe('right');
    expect(calls).toBeLessThan(20);
    expect(ringSearch(() => 'here', 1, 1, 0)).toBe('here');
  });
});

describe('aiming with the arrow keys', () => {
  const all = () => true;
  test('one step where there is room', () => {
    expect(aimNext({ zone: 'h', at: 0 }, 'ArrowRight', false, 330, all)).toEqual({ zone: 'h', at: 5 });
  });
  test('over a stretch with no room, on to the next that has some', () => {
    const gap = (p: Place) => !(p.zone === 'h' && p.at > 0 && p.at < 40);
    expect(aimNext({ zone: 'h', at: 0 }, 'ArrowRight', false, 330, gap)).toEqual({ zone: 'h', at: 40 });
  });
  test('nowhere to go that way: stays', () => {
    expect(aimNext({ zone: 'r', at: 0 }, 'ArrowDown', false, 330, all)).toEqual({ zone: 'r', at: 0 });
    expect(aimNext({ zone: 'r', at: 20 }, 'ArrowDown', false, 330, (p) => p.at > 18)).toBeNull();
    expect(aimNext({ zone: 'h', at: 0 }, 'ArrowRight', true, 330, () => false)).toBeNull();
    expect(aimNext({ zone: 'h', at: 0 }, 'Enter', false, 330, all)).toBeNull();
  });
  test('agrees with a single step whenever that step has room', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) for (const at of [0, 45, 150, 300]) {
      expect(aimNext({ zone: 'h', at }, key, false, 330, all)).toEqual(aimStep({ zone: 'h', at }, key, false, 330));
    }
  });
});
