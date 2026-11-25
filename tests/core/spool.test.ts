import { test, expect } from 'bun:test';
import { Box3, Vector3 } from 'three';
import { buildSpool } from '../../src/core/spool';

const box = (name: string) => {
  const p = buildSpool().find((x) => x.name === name)!;
  p.geometry.computeBoundingBox();
  return p.geometry.boundingBox!;
};

test('the spool stands on the origin, to size, under budget, with no uv', () => {
  const b = new Box3(); let tris = 0;
  for (const p of buildSpool()) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox!); tris += p.geometry.index!.count / 3; expect(p.geometry.getAttribute('uv')).toBeUndefined(); }
  expect(b.min.y).toBeCloseTo(0, 6); expect(b.max.y).toBeCloseTo(0.07, 3); expect(b.max.x - b.min.x).toBeCloseTo(0.11, 3);
  expect(tris).toBeLessThanOrEqual(4000);
});

test('the winding sits inside the flanges', () => {
  const s = box('spool_string'), f = box('spool');
  expect(s.max.x).toBeLessThan(f.max.x);
  expect(s.min.y).toBeGreaterThan(f.min.y); expect(s.max.y).toBeLessThan(f.max.y);
});

test('the winding is ridged: its outer radius alternates turn to turn, with a crease between', () => {
  const pos = buildSpool().find((x) => x.name === 'spool_string')!.geometry.getAttribute('position');
  const rings = new Map<number, number>(); // widest radius at each height
  for (let i = 0; i < pos.count; i++) {
    const y = Math.round(pos.getY(i) * 1e5);
    rings.set(y, Math.max(rings.get(y) ?? 0, Math.hypot(pos.getX(i), pos.getZ(i))));
  }
  // Bottom to top, a turn is the run of rings between two creases.
  const turns: number[] = [];
  let inTurn = false;
  for (const [, r] of [...rings].sort(([a], [b]) => a - b)) {
    if (r < 0.041) inTurn = false;
    else if (inTurn) turns[turns.length - 1] = Math.max(turns.at(-1)!, r);
    else { turns.push(r); inTurn = true; }
  }
  expect(turns.length).toBe(12);
  turns.forEach((r, i) => expect(r).toBeCloseTo(i % 2 === 0 ? 0.0428 : 0.0422, 5));
});

/** Every triangle's corners, its own normal, and its area. */
function* triangles(name: string) {
  const g = buildSpool().find((p) => p.name === name)!.geometry;
  const pos = g.getAttribute('position'), index = g.index!;
  for (let i = 0; i < index.count; i += 3) {
    const v = [0, 1, 2].map((k) => index.getX(i + k));
    const [a, b, c] = v.map((k) => new Vector3().fromBufferAttribute(pos, k));
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    yield { v, centre: a.clone().add(b).add(c).divideScalar(3), normal: n.clone().normalize(), area: n.length() / 2 };
  }
}

test('no triangle is degenerate', () => {
  for (const name of ['spool', 'spool_string']) for (const t of triangles(name)) expect(t.area).toBeGreaterThan(1e-9);
});

test('every face points outward', () => {
  for (const t of triangles('spool_string')) {
    const end = Math.abs(t.normal.y) > 0.999; // the winding's two end discs face the flanges
    expect(end ? Math.sign(t.normal.y) * Math.sign(t.centre.y - 0.035) : t.centre.x * t.normal.x + t.centre.z * t.normal.z).toBeGreaterThan(0);
  }
  for (const t of triangles('spool')) {
    if (Math.abs(t.normal.y) < 0.5) {
      expect(t.centre.x * t.normal.x + t.centre.z * t.normal.z).toBeGreaterThan(0); // rims and core
    } else {
      // Flat faces: the two outer ones look away from the middle, the two that hold the winding look at it.
      const outer = Math.abs(t.centre.y - 0.035) > 0.034;
      expect(t.normal.y * (t.centre.y - 0.035) * (outer ? 1 : -1)).toBeGreaterThan(0);
    }
  }
});

test('hard corners are hard: the body is shaded with each face by itself', () => {
  const g = buildSpool().find((p) => p.name === 'spool')!.geometry;
  const nor = g.getAttribute('normal');
  for (const t of triangles('spool')) {
    // A flat face is flat to its rim; a rim or the core has no tilt at all.
    for (const v of t.v) expect(nor.getY(v)).toBeCloseTo(Math.abs(t.normal.y) > 0.5 ? Math.sign(t.normal.y) : 0, 5);
  }
});

test('each turn of the winding is rounded, and creased against the next', () => {
  const g = buildSpool().find((p) => p.name === 'spool_string')!.geometry;
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const tilts = new Map<number, Set<string>>(); // at each height, which ways the surface leans
  let crest = 0, crease = 1;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i)), ny = nor.getY(i);
    if (Math.abs(ny) > 0.999) continue; // the end discs
    if (r > 0.041) crest = Math.max(crest, Math.abs(ny));
    else crease = Math.min(crease, Math.abs(ny));
    const y = Math.round(pos.getY(i) * 1e5);
    tilts.set(y, (tilts.get(y) ?? new Set()).add(ny > 0 ? 'up' : 'down'));
  }
  expect(crest).toBeLessThan(crease); // turning outward from crease to crest
  // Every crease but the first and last is the top of one turn and the bottom of the next; nothing else is two ways at once.
  expect([...tilts.values()].filter((t) => t.size === 2).length).toBe(11);
});
