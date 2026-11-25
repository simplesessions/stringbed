import { test, expect } from 'bun:test';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, TorusGeometry, Triangle, Vector3, type Object3D } from 'three';
import { HOOP_RADIAL } from '../src/core/section';
import { bedLines, type Beds } from '../src/restring';
import { placeTape, tapeAt, tapeGeometry, type PlacedTape, type TapePiece } from '../src/tape';
import { catalog, load, part, points } from './models';

const O_PORT = 'prince-o3-phantom-100x';
const JUNIOR = 'babolat-pure-aero-junior-25-2026';
const PURE_AERO = 'babolat-pure-aero-100';
const open = async (id: string) => {
  const root = await load(`realistic/${id}.glb`);
  return { root, beds: bedLines(root)! };
};
const piece = (zone: TapePiece['zone'], at: number, more: Partial<TapePiece> = {}): TapePiece => ({ zone, at, mirrored: false, lengthMm: 40, layers: 1, ...more });

/** Distance from a point to the nearest triangle of the named parts. */
function surface(root: Object3D, names: string[]): (p: Vector3) => number {
  const tris = names.flatMap((n) => {
    const mesh = part(root, n), v = points(mesh), idx = mesh.geometry.index!;
    return Array.from({ length: idx.count / 3 }, (_, t) => new Triangle(v[idx.getX(3 * t)], v[idx.getX(3 * t + 1)], v[idx.getX(3 * t + 2)]));
  });
  const q = new Vector3();
  return (p) => Math.min(...tris.map((t) => t.closestPointToPoint(p, q).distanceTo(p)));
}
const gaps = (path: Vector3[]) => path.slice(1).map((p, i) => p.distanceTo(path[i]));
const lengthMm = (path: Vector3[]) => 1000 * gaps(path).reduce((a, b) => a + b, 0);
/** The point half way along a path. */
function middle(path: Vector3[]): Vector3 {
  const d = gaps(path);
  let left = d.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < d.length; i++) {
    if (left <= d[i]) return path[i].clone().lerp(path[i + 1], left / d[i]);
    left -= d[i];
  }
  return path[path.length - 1];
}
/** Degrees between two clock angles. */
const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const centreY = (beds: Beds) => (Math.min(...beds.mains.lines.map((l) => l.from)) + Math.max(...beds.mains.lines.map((l) => l.to))) / 2;

test.each([PURE_AERO, 'yonex-ezone-100', O_PORT, JUNIOR])('%s: hoop tape at 12, 3, 5 and 9 o’clock lies on the frame', async (id) => {
  const { root, beds } = await open(id);
  const off = surface(root, ['frame']);
  const centre = new Vector3(0, centreY(beds), 0);
  for (const at of [0, 90, 150, 270]) for (const mm of [10, 40, 120]) {
    const placed = placeTape(root, beds, piece('h', at, { lengthMm: mm }));
    expect(placed).toHaveLength(1);
    const { path, normals } = placed[0];
    expect(normals).toHaveLength(path.length);
    for (const p of path) expect(off(p)).toBeLessThan(0.001);
    expect(Math.abs(lengthMm(path) - mm)).toBeLessThan(2);
    // The inner rim, beside the strings: every normal looks back at the middle of the bed.
    path.forEach((p, i) => {
      expect(Math.abs(p.z)).toBeCloseTo(0.005, 6);
      expect(normals[i].length()).toBeCloseTo(1, 6);
      expect(normals[i].dot(centre.clone().sub(p))).toBeGreaterThan(0);
    });
    const m = middle(path);
    expect(apart(at, (Math.atan2(m.x, m.y - centre.y) * 180) / Math.PI + 360)).toBeLessThan(1);
  }
});

test('every racquet takes side tape at 60 and 150 mm on both sides', async () => {
  expect(catalog.racquets).toHaveLength(358);
  for (const r of catalog.racquets) {
    const { root, beds } = await open(r.id);
    for (const zone of ['l', 'r'] as const) for (const at of [60, 150]) {
      const placed = placeTape(root, beds, piece(zone, at));
      expect({ id: r.id, zone, at, n: placed.length }).toEqual({ id: r.id, zone, at, n: 1 });
      const { path, normals, centroid } = placed[0];
      const side = zone === 'r' ? 1 : -1;
      for (const p of [...path, centroid]) {
        expect(side * p.x).toBeGreaterThan(0.008);
        expect(side * p.x).toBeLessThan(0.06);
      }
      for (const n of normals) expect(side * n.x).toBeGreaterThan(0);
      expect(Math.abs(lengthMm(path) - 40)).toBeLessThan(2);
      expect(Math.abs(centroid.y * 1000 - at)).toBeLessThan(3); // a step at the collar shifts it a little
    }
  }
}, 120_000);

test('side tape lies on the arm or handle', async () => {
  const { root, beds } = await open(PURE_AERO);
  const off = surface(root, ['frame', 'collar', 'grip']);
  for (const zone of ['l', 'r'] as const) for (const at of [60, 180, 260, 320]) {
    const [t] = placeTape(root, beds, piece(zone, at));
    for (const p of t.path) expect(off(p)).toBeLessThan(0.001);
  }
});

test.each([PURE_AERO, 'yonex-ezone-100', O_PORT, JUNIOR])('%s: mirrored 3 o’clock is one piece each side, equal and opposite in x', async (id) => {
  const { root, beds } = await open(id);
  const p = piece('h', 90, { mirrored: true });
  const [a, b, ...more] = placeTape(root, beds, p);
  expect(more).toEqual([]);
  expect(a.centroid.x).toBeGreaterThan(0.08);
  expect(b.centroid.x).toBeCloseTo(-a.centroid.x, 4);
  expect(b.centroid.y).toBeCloseTo(a.centroid.y, 4);
  expect(b.centroid.z).toBeCloseTo(a.centroid.z, 6);
  // Both lead back to the piece that was asked for.
  expect(a.piece).toBe(p); expect(b.piece).toBe(p);
  for (const at of [60, 150]) {
    const [l, r, ...rest] = placeTape(root, beds, piece('l', at, { mirrored: true }));
    expect(rest).toEqual([]);
    expect(l.centroid.x).toBeLessThan(0);
    expect(r.centroid.x).toBeCloseTo(-l.centroid.x, 4);
    expect(r.centroid.y).toBeCloseTo(l.centroid.y, 4);
    expect(Math.abs(l.centroid.y * 1000 - at)).toBeLessThan(3);
  }
});

/** Half a ring as a hoop: side 1 right, -1 left; z is where its tube sits. */
function hoop(beds: Beds, halves: Array<[side: 1 | -1, z: number]>): Object3D {
  const root = new Group();
  const geometry = new BufferGeometry();
  const positions: number[] = [], index: number[] = [];
  for (const [side, z] of halves) {
    const g = new TorusGeometry(0.12, 0.004, 12, 45, Math.PI).rotateZ(-side * Math.PI / 2).translate(0, centreY(beds), z);
    const base = positions.length / 3;
    positions.push(...g.getAttribute('position').array);
    index.push(...[...g.index!.array].map((i) => i + base));
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)).setIndex(index);
  const frame = new Mesh(geometry, new MeshBasicMaterial());
  frame.name = 'frame';
  root.add(frame);
  return root;
}

test('a mirrored piece lies on both sides and on one face, or not at all', async () => {
  const { beds } = await open(PURE_AERO);
  const p = piece('h', 90, { mirrored: true });
  // The left has room at the back only, so both go there.
  const placed = placeTape(hoop(beds, [[1, 0.006], [1, -0.006], [-1, -0.006]]), beds, p);
  expect(placed).toHaveLength(2);
  for (const t of placed) for (const q of t.path) expect(q.z).toBeCloseTo(-0.005, 6);
  // Nothing on the left, or no face in common: nothing at all.
  expect(placeTape(hoop(beds, [[1, 0.006], [1, -0.006]]), beds, p)).toEqual([]);
  expect(placeTape(hoop(beds, [[1, 0.006], [-1, -0.006]]), beds, p)).toEqual([]);
});

test('mirrored 12 o’clock is one piece', async () => {
  const { root, beds } = await open(PURE_AERO);
  for (const at of [0, 180, 360]) expect(placeTape(root, beds, piece('h', at, { mirrored: true }))).toHaveLength(1);
});

test('tapeAt of a placed piece’s middle gives back its zone and place', async () => {
  for (const id of [PURE_AERO, 'yonex-ezone-100', O_PORT, JUNIOR]) {
    const { root, beds } = await open(id);
    for (let at = 0; at < 360; at += 15) {
      const got = tapeAt(root, beds, middle(placeTape(root, beds, piece('h', at))[0].path));
      expect({ id, at, zone: got.zone }).toEqual({ id, at, zone: 'h' });
      expect(apart(got.at, at)).toBeLessThanOrEqual(2);
      expect(got.at).toBeGreaterThanOrEqual(0); expect(got.at).toBeLessThan(360);
    }
    for (const zone of ['l', 'r'] as const) for (const at of [60, 150, 220]) {
      const got = tapeAt(root, beds, middle(placeTape(root, beds, piece(zone, at, { lengthMm: 20 }))[0].path));
      expect({ id, at, zone: got.zone }).toEqual({ id, at, zone });
      expect(Math.abs(got.at - at)).toBeLessThanOrEqual(2);
    }
  }
});

test('a click on the hoop’s inner side, face or outer side is the same place', async () => {
  const { root, beds } = await open(PURE_AERO);
  for (const at of [0, 45, 90, 180, 200, 300]) {
    const [t] = placeTape(root, beds, piece('h', at));
    const rim = middle(t.path), cy = centreY(beds);
    for (const out of [0, 0.005, 0.01]) { // metres out from the inner rim
      const d = new Vector3(rim.x, rim.y - cy, 0);
      const hit = d.setLength(d.length() + out).add(new Vector3(0, cy, 0.01));
      const got = tapeAt(root, beds, hit);
      expect(got.zone).toBe('h');
      expect(apart(got.at, at)).toBeLessThanOrEqual(2);
    }
  }
});

test('every racquet takes tape where a click at the top of its arms said', async () => {
  for (const r of catalog.racquets) {
    const { root, beds } = await open(r.id);
    const limit = Math.min(...beds.mains.lines.map((l) => l.from)) - Math.max(...Object.values(HOOP_RADIAL)); // where the hoop starts
    const said = new Map<string, Pick<TapePiece, 'zone' | 'at'>>();
    for (const x of [-0.05, 0.05]) for (let mm = -1.5; mm <= 1.5; mm += 0.05) {
      const got = tapeAt(root, beds, new Vector3(x, limit + mm / 1000, 0));
      said.set(`${got.zone}${got.at}`, got);
    }
    said.set('just under', tapeAt(root, beds, new Vector3(0.05, limit - 0.00001, 0)));
    expect(new Set([...said.values()].map((p) => p.zone))).toEqual(new Set(['h', 'l', 'r']));
    for (const p of said.values()) {
      if (p.zone === 'h') continue;
      expect({ id: r.id, ...p, n: placeTape(root, beds, piece(p.zone, p.at)).length }).toEqual({ id: r.id, ...p, n: 1 });
      // Asking again about the piece's own place gives the same answer.
      expect(tapeAt(root, beds, new Vector3(p.zone === 'r' ? 0.05 : -0.05, p.at / 1000, 0))).toEqual(p);
    }
  }
}, 120_000);

test('no piece laps itself', async () => {
  for (const id of [PURE_AERO, JUNIOR]) {
    const { root, beds } = await open(id);
    const fits = (lengthMm: number) => placeTape(root, beds, piece('h', 0, { lengthMm }))[0];
    let lo = 400, hi = 1500; // the longest accepted piece, to 1 mm
    while (hi - lo > 1) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    const { path } = fits(lo);
    const angle = (p: Vector3) => (Math.atan2(p.x, p.y - centreY(beds)) * 180) / Math.PI;
    // Walked one way round, the angle never covers more than a turn, and nearly all of one.
    let swept = 0;
    for (let i = 1; i < path.length; i++) swept += ((angle(path[i]) - angle(path[i - 1]) + 540) % 360) - 180;
    expect(swept).toBeLessThanOrEqual(360.001);
    expect(swept).toBeGreaterThan(355);
  }
}, 30_000);

test('a piece too short or without a layer gives []', async () => {
  const { root, beds } = await open(PURE_AERO);
  for (const lengthMm of [0.001, 0.5, -10, 0, NaN, Infinity]) for (const zone of ['h', 'r'] as const) expect(placeTape(root, beds, piece(zone, 90, { lengthMm }))).toEqual([]);
  for (const layers of [0, -1, 0.5, NaN, Infinity]) expect(placeTape(root, beds, piece('h', 90, { layers }))).toEqual([]);
  for (const zone of ['h', 'r'] as const) { // the shortest there is
    const [t] = placeTape(root, beds, piece(zone, 90, { lengthMm: 1 }));
    expect(t.path.length).toBeGreaterThanOrEqual(2);
    expect([...tapeGeometry(t).getAttribute('position').array, ...t.centroid.toArray()].every(Number.isFinite)).toBe(true);
  }
});

test('an impossible piece gives [] and does not throw', async () => {
  const { root, beds } = await open(PURE_AERO);
  const impossible: TapePiece[] = [
    piece('r', 900), piece('l', -50), piece('r', 5), piece('r', 500), piece('h', NaN), piece('l', Infinity),
    piece('h', 90, { lengthMm: 0 }), piece('h', 90, { lengthMm: NaN }), piece('h', 90, { lengthMm: 1e6 }), piece('r', 100, { lengthMm: 5000 }),
  ];
  for (const p of impossible) expect(placeTape(root, beds, p)).toEqual([]);
  expect(placeTape(new Group(), beds, piece('h', 90))).toEqual([]);
});

test('a hoop with nothing on the front takes the tape on its back', async () => {
  const { beds } = await open(PURE_AERO);
  const root = new Group();
  const ring = new Mesh(new TorusGeometry(0.12, 0.004, 12, 90), new MeshBasicMaterial());
  ring.name = 'frame';
  ring.position.set(0, centreY(beds), -0.006);
  root.add(ring);
  const [t] = placeTape(root, beds, piece('h', 90));
  for (const p of t.path) expect(p.z).toBeCloseTo(-0.005, 6);
});

test('placing tape alters nothing in the model', async () => {
  const { root, beds } = await open(PURE_AERO);
  const before = JSON.stringify(root.toJSON().object);
  const uuids = () => ['frame', 'collar', 'grip'].map((n) => [part(root, n).geometry.uuid, (part(root, n).material as MeshBasicMaterial).uuid, (part(root, n).material as MeshBasicMaterial).side]);
  const ids = uuids();
  placeTape(root, beds, piece('h', 90, { mirrored: true }));
  placeTape(root, beds, piece('l', 150, { mirrored: true }));
  expect(JSON.stringify(root.toJSON().object)).toBe(before);
  expect(uuids()).toEqual(ids);
});

test('tape is placed in racquet space however the model is turned', async () => {
  const { root, beds } = await open(PURE_AERO);
  const flat = placeTape(root, beds, piece('h', 60))[0];
  root.position.set(1, 2, 3); root.rotation.set(0.3, 0.7, 0.1); root.updateMatrixWorld(true);
  expect(placeTape(root, beds, piece('h', 60))[0].path).toEqual(flat.path);
});

test('the centroid weighs each stretch of the path by its length', async () => {
  const { root, beds } = await open(PURE_AERO);
  const [t] = placeTape(root, beds, piece('h', 90, { lengthMm: 200 }));
  // A straight average of the points would weigh short steps as much as long ones.
  let sum = new Vector3(), total = 0;
  for (let i = 1; i < t.path.length; i++) {
    const d = t.path[i].distanceTo(t.path[i - 1]);
    sum = sum.addScaledVector(t.path[i].clone().add(t.path[i - 1]), d / 2); total += d;
  }
  expect(t.centroid.distanceTo(sum.divideScalar(total))).toBeLessThan(1e-9);
});

test('the ribbon is 6.35 mm wide, 0.2 mm proud a layer, and faces out', async () => {
  const { root, beds } = await open(PURE_AERO);
  for (const [zone, at] of [['h', 0], ['h', 150], ['l', 150], ['r', 60]] as const) for (const layers of [1, 3]) {
    const [t] = placeTape(root, beds, piece(zone, at, { layers })) as [PlacedTape];
    const g = tapeGeometry(t);
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), idx = g.index!;
    const v = Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i));
    expect(v.every((p) => Number.isFinite(p.x + p.y + p.z))).toBe(true);
    const n0 = t.normals[0], p0 = t.path[0];
    const ahead = t.path[1].clone().sub(p0).normalize();
    const start = v.filter((p) => Math.abs(p.clone().sub(p0).dot(ahead)) < 1e-4);
    const width = Math.max(...start.flatMap((a) => start.map((b) => a.clone().sub(b).projectOnPlane(n0).length())));
    expect(width).toBeCloseTo(0.00635, 5);
    expect(Math.max(...start.map((p) => p.clone().sub(p0).dot(n0)))).toBeCloseTo(0.0002 * layers, 6);
    // Winding agrees with the stored normals, and the top looks the way the surface does.
    for (let i = 0; i < idx.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => v[idx.getX(i + k)]);
      const face = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      for (let k = 0; k < 3; k++) expect(face.dot(new Vector3().fromBufferAttribute(nor, idx.getX(i + k)))).toBeGreaterThan(0);
    }
    for (const p of t.path) expect(Math.min(...v.map((q) => q.distanceTo(p)))).toBeLessThan(0.00635); // it runs the whole path
  }
});
