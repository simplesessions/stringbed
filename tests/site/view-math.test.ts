import { test, expect } from 'bun:test';
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { between, ease, fitDistance, holdTarget, partBoxes } from '../../site/src/view-math';

/** A racquet-shaped stack of boxes with the public part names. */
function racquet(): Group {
  const g = new Group();
  const add = (name: string, w: number, from: number, to: number, d = 0.023) => {
    const m = new Mesh(new BoxGeometry(w, to - from, d));
    m.name = name;
    m.position.y = (from + to) / 2;
    g.add(m);
  };
  add('frame', 0.26, 0.17, 0.6858);
  add('strings_mains', 0.23, 0.35, 0.67, 0.002);
  add('strings_crosses', 0.23, 0.36, 0.66, 0.002);
  add('grip', 0.034, 0.01, 0.18, 0.03);
  add('butt_cap', 0.038, 0, 0.02, 0.034);
  return g;
}
const all = new Box3(new Vector3(-0.13, 0, -0.0115), new Vector3(0.13, 0.6858, 0.0115));

test('part views stack from handle to head and stay on the racquet', () => {
  const { head, throat, handle } = partBoxes(racquet());
  expect(handle.min.y).toBeCloseTo(0);
  expect(handle.max.y).toBeCloseTo(0.18);
  expect(throat.min.y).toBeCloseTo(0.18);
  expect(throat.max.y).toBeGreaterThan(0.35); // shows where it meets the hoop
  expect(head.min.y).toBeLessThan(0.35);
  expect(head.max.y).toBeCloseTo(0.6858);
  expect(handle.max.x - handle.min.x).toBeLessThan(0.05);
});

test('a model without the named parts still gives usable boxes', () => {
  const g = new Group();
  g.add(new Mesh(new BoxGeometry(0.2, 0.6, 0.02)));
  for (const box of Object.values(partBoxes(g))) expect(box.isEmpty()).toBe(false);
});

test('fitting a tall box in a narrow view is limited by whichever side is tighter', () => {
  const tall = fitDistance(all, 28, 1.2);
  expect(tall).toBeCloseTo((0.6858 * 1.16) / (2 * Math.tan((14 * Math.PI) / 180)));
  expect(fitDistance(all, 28, 0.2)).toBeGreaterThan(tall);
});

test('a pan reaches both ends of the racquet but not past them', () => {
  const butt = new Vector3(0, 0, 0);
  expect(holdTarget(butt, all, 0.5, 1.6).length()).toBe(0);
  const gone = new Vector3(2, 3, 0);
  const moved = holdTarget(gone, all, 0.5, 1.6);
  expect(gone.y).toBeCloseTo(0.6858);
  expect(gone.x).toBeCloseTo(0.13);
  expect(moved.y).toBeCloseTo(0.6858 - 3);
});

test('zooming far out brings the racquet back to the middle', () => {
  const t = new Vector3(0.1, 0, 0.1);
  holdTarget(t, all, 1.6 * 1.5, 1.6);
  expect(t.distanceTo(new Vector3(0, 0.3429, 0))).toBeCloseTo(0);
});

test('a glide starts and ends exactly on its poses and turns the short way', () => {
  const a = { target: new Vector3(0, 0.3, 0), offset: new Vector3(Math.sin(3), 0.1, Math.cos(3)) };
  const b = { target: new Vector3(0, 0.1, 0), offset: new Vector3(Math.sin(-3), 0.1, Math.cos(-3)).multiplyScalar(0.5) };
  expect(between(a, b, 0).offset.distanceTo(a.offset)).toBeCloseTo(0);
  expect(between(a, b, 1).offset.distanceTo(b.offset)).toBeCloseTo(0);
  const mid = between(a, b, 0.5);
  expect(mid.offset.z).toBeLessThan(0); // through the back, not swinging past the front
  expect(mid.target.y).toBeCloseTo(0.2);
  expect(ease(0)).toBe(0);
  expect(ease(2)).toBe(1);
});
