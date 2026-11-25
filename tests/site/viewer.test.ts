import { test, expect } from 'bun:test';
import { Box3, Color, Mesh, OrthographicCamera, Raycaster, Triangle, Vector3, type BufferGeometry, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { MARKER_LAYER } from '../../site/src/look-passes';
import { tinted } from '../../site/src/studio';
import { Outfit, surfaceUnder, type Dress } from '../../site/src/viewer';
import { DAMPENER_DEPTH, DAMPENER_HEIGHT, DAMPENER_WIDTH } from '../../src/core/trim';
import { dampenerMass } from '../../src/mass';
import { bedLines, type Beds, type Strand } from '../../src/restring';
import { placeTape, tapeGeometry, type TapePiece } from '../../src/tape';
import { catalog, load, part } from '../models';

const PURE_AERO = 'babolat-pure-aero-100';
const RACQUETS = [PURE_AERO, 'yonex-ezone-100', 'prince-o3-phantom-100x', 'head-speed-junior-25', 'prince-o3-legacy-120-2024'];
const black: Strand = { color: '#111111', finish: 'matte', gaugeMm: 1.25, sides: 6 };
const yellow: Strand = { color: '#ffd400', finish: 'gloss', gaugeMm: 1.3, sides: 0 };
const tape = (zone: TapePiece['zone'], at: number, more: Partial<TapePiece> = {}): TapePiece => ({ zone, at, mirrored: false, lengthMm: 40, layers: 1, ...more });
const bare: Dress = { strings: null, tape: [], overgrip: null, dampener: null, balanceMm: null };
const all = (): Dress => ({ strings: { mains: { ...black }, crosses: { ...yellow } }, tape: [tape('h', 90, { mirrored: true }), tape('l', 100)], overgrip: '#ffffff', dampener: '#cc2222', balanceMm: 320 });

/** What the viewer has: a clone of a model the thumbnails share. */
async function wardrobe(id = PURE_AERO) {
  const source = await load(`realistic/${id}.glb`);
  const root = tinted(source, {});
  const beds = bedLines(root)!;
  return { source, root, beds, outfit: new Outfit(root, beds) };
}
const meshes = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => void ((o as Mesh).isMesh && out.push(o as Mesh)));
  return out;
};
const named = (root: Object3D, name: string) => meshes(root).filter((m) => m.name === name);
const snap = (root: Object3D) => meshes(root).map((m) => ({ name: m.name, geometry: m.geometry, material: m.material, visible: m.visible, position: m.position.toArray(), scale: m.scale.toArray(), colour: (m.material as MeshStandardMaterial).color.getHex() }));
const marker = (root: Object3D) => named(root, 'marker_balance')[0] as Mesh | undefined;
const boxOf = (m: Mesh) => new Box3().setFromObject(m);

/** Everything on the model that the source does not hold, watched for disposal. */
function made(root: Object3D, source: Object3D) {
  const shared = new Set<unknown>(meshes(source).flatMap((m) => [m.geometry, m.material]));
  const own = new Set<BufferGeometry | Material>(meshes(root).flatMap((m) => [m.geometry, m.material as Material]).filter((x) => !shared.has(x)));
  const gone = new Set<unknown>();
  for (const x of own) (x as Material).addEventListener('dispose', () => gone.add(x));
  return { own, gone };
}

test.each(RACQUETS)('%s: wears everything, takes it all off, and the shared source never changes', async (id) => {
  const { source, root, outfit } = await wardrobe(id);
  const before = snap(root), untouched = snap(source);
  const lost: string[] = [];
  for (const m of meshes(source)) for (const x of [m.geometry, m.material as Material]) (x as Material).addEventListener('dispose', () => lost.push(m.name));
  expect(outfit.wear(all())).toBe(true);
  expect(snap(source)).toEqual(untouched);
  expect(named(root, 'tape')).toHaveLength(3);
  expect(part(root, 'strings_mains').material).not.toBe(part(source, 'strings_mains').material);
  expect(named(root, 'dampener')).toHaveLength(1);
  expect(marker(root)).toBeDefined();
  const { own, gone } = made(root, source);
  expect(own.size).toBeGreaterThan(8);
  expect(outfit.wear(null)).toBe(true);
  expect(snap(root)).toEqual(before);
  expect(snap(source)).toEqual(untouched);
  expect(gone).toEqual(own);
  expect(lost).toEqual([]);
});

test('the same build again changes nothing, whatever order its keys are in', async () => {
  const { root, outfit } = await wardrobe();
  outfit.wear(all());
  const before = snap(root);
  const shuffled: Dress = JSON.parse(JSON.stringify(all()), (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v));
  expect(outfit.wear(shuffled)).toBe(false);
  expect(snap(root)).toEqual(before);
});

test('a build with nothing in it is stock', async () => {
  const { root, outfit } = await wardrobe();
  const before = snap(root);
  expect(outfit.wear(bare)).toBe(false);
  expect(outfit.wear(null)).toBe(false);
  expect(snap(root)).toEqual(before);
});

test('only what differs is made again', async () => {
  const { root, outfit } = await wardrobe();
  const look = () => ({
    strings: [part(root, 'strings_mains').geometry, part(root, 'strings_crosses').geometry],
    tape: named(root, 'tape'),
    overgrip: part(root, 'grip').material,
    dampener: named(root, 'dampener')[0],
    marker: marker(root)!.position.y,
  });
  type Key = keyof ReturnType<typeof look>;
  const changes: Array<[Key, Partial<Dress>]> = [
    ['strings', { strings: { mains: black, crosses: black } }],
    ['tape', { tape: [tape('h', 90, { mirrored: true }), tape('l', 101)] }],
    ['overgrip', { overgrip: '#222222' }],
    ['dampener', { dampener: '#2222cc' }],
    ['marker', { balanceMm: 321 }],
  ];
  for (const [key, change] of changes) {
    outfit.wear(all());
    const before = look();
    expect(outfit.wear({ ...all(), ...change })).toBe(true);
    const after = look();
    for (const k of Object.keys(before) as Key[]) {
      const same = [before[k]].flat().every((x, i) => x === [after[k]].flat()[i]);
      expect({ change: key, part: k, same }).toEqual({ change: key, part: k, same: k !== key });
    }
  }
});

test('the overgrip covers the grip alone, in a material of its own', async () => {
  const { source, root, outfit } = await wardrobe();
  const stock = part(source, 'grip').material;
  outfit.wear({ ...bare, overgrip: '#ffffff' });
  expect((part(root, 'grip').material as MeshStandardMaterial).color.getHexString()).toBe('ffffff');
  expect((part(root, 'grip').material as MeshStandardMaterial).roughness).toBe(0.85);
  expect(part(root, 'grip').geometry).toBe(part(source, 'grip').geometry);
  for (const name of ['collar', 'butt_cap', 'frame']) expect(part(root, name).material).toBe(part(source, name).material);
  outfit.wear({ ...bare, overgrip: null });
  expect(part(root, 'grip').material).toBe(stock);
});

test('tape lies where placeTape puts it, lead grey, on the model itself; a piece that cannot lie is left out', async () => {
  const { root, beds, outfit } = await wardrobe();
  const piece = tape('h', 45, { mirrored: true, layers: 2 });
  const want = placeTape(root, beds, piece).map((p) => new Box3().setFromBufferAttribute(tapeGeometry(p).getAttribute('position') as never));
  outfit.wear({ ...bare, tape: [piece, tape('r', 9999)] });
  const on = named(root, 'tape');
  expect(on.map(boxOf)).toEqual(want);
  for (const m of on) {
    expect(m.parent).toBe(root);
    const { color, roughness } = m.material as MeshStandardMaterial;
    expect([color.getHexString(), roughness]).toEqual(['9a9ea3', 0.85]);
    expect(m.receiveShadow).toBe(true);
  }
});

/** What is wrong with where a dampener lies: between the centre mains, on the lowest cross alone, clear of the frame. */
function dampenerFaults(root: Object3D, beds: Beds, b: Box3): string[] {
  const faults: string[] = [];
  const say = (bad: boolean, what: string) => void (bad && faults.push(what));
  const xs = beds.mains.lines.map((l) => l.at);
  const left = Math.max(...xs.filter((x) => x < b.min.x)), right = Math.min(...xs.filter((x) => x > b.max.x));
  const middle = [...xs].sort((p, q) => Math.abs(p) - Math.abs(q))[0];
  say(xs.some((x) => x > b.min.x - 0.0007 && x < b.max.x + 0.0007), 'a main runs through it');
  say(Math.abs((b.min.x + b.max.x) / 2 - (left + right) / 2) > 1e-6, 'off centre');
  say(middle !== left && middle !== right, 'not at the middle mains');
  const [lowest, next] = beds.crosses.lines.map((l) => l.at).sort((p, q) => p - q);
  say(b.min.y > lowest || b.max.y < lowest, 'not on the lowest cross');
  say(b.max.y > next - 0.002, 'up to the next cross');
  say(b.min.y < Math.max(...beds.mains.lines.filter((l) => l.at === left || l.at === right).map((l) => l.from)), 'below the mains');
  say(Math.abs(b.max.y - b.min.y - DAMPENER_HEIGHT) > 1e-6, 'a strange height');
  say(b.max.x - b.min.x < 0.0045 || b.max.x - b.min.x > DAMPENER_WIDTH + 1e-9, 'a strange width');
  say(Math.abs(b.max.z - DAMPENER_DEPTH / 2) > 1e-6 || Math.abs(b.min.z + DAMPENER_DEPTH / 2) > 1e-6, 'a strange depth');
  for (const name of ['frame', 'grommets', 'bumper']) {
    const mesh = part(root, name), v = verticesNear(mesh, b.min.y, Infinity), idx = mesh.geometry.index!;
    for (let i = 0; i < idx.count; i += 3) {
      if (b.intersectsTriangle(new Triangle(v[idx.getX(i)], v[idx.getX(i + 1)], v[idx.getX(i + 2)]))) {
        faults.push(`runs into the ${name}`);
        break;
      }
    }
  }
  return faults;
}

test('on every published file the dampener sits on the lowest cross, full size and clear of the bridge', async () => {
  for (const f of catalog.files) {
    const root = await load(f.path);
    const beds = bedLines(root)!;
    new Outfit(root, beds).wear({ ...bare, dampener: '#cc2222' });
    const b = boxOf(named(root, 'dampener')[0]);
    expect({ path: f.path, faults: dampenerFaults(root, beds, b) }).toEqual({ path: f.path, faults: [] });
    const m = dampenerMass(beds);
    const at = b.getCenter(new Vector3());
    expect([at.x - m.x, at.y - m.y].map((d) => Math.abs(d) < 1e-6)).toEqual([true, true]); // weighed where it is drawn
  }
}, 120_000);

test('the dampener casts a shadow, as a part of the racquet does; tape is too thin to', async () => {
  const { root, outfit } = await wardrobe();
  outfit.wear(all());
  expect(named(root, 'dampener').map((m) => [m.castShadow, m.receiveShadow])).toEqual([[true, true]]);
  expect(named(root, 'tape').map((m) => [m.castShadow, m.receiveShadow])).toEqual(Array(3).fill([false, true]));
});

test('a piece of tape that stays keeps its mesh while another moves, comes or goes, in any order', async () => {
  const { root, outfit } = await wardrobe();
  const [a, b, c] = [tape('h', 90, { mirrored: true }), tape('l', 100), tape('r', 250)];
  const on = () => named(root, 'tape');
  const of = (list: TapePiece[]) => { outfit.wear({ ...bare, tape: list }); return on(); };
  const first = of([a, b]);
  expect(first).toHaveLength(3);
  const gone: Mesh[] = [];
  for (const m of first) m.geometry.addEventListener('dispose', () => gone.push(m));
  const moved = of([a, { ...b, at: 101 }]);
  expect(moved).toHaveLength(3);
  expect(moved.filter((m) => first.includes(m))).toHaveLength(2); // both sides of the mirrored one
  expect(gone).toHaveLength(1);
  const kept = first.filter((m) => moved.includes(m));
  const more = of([c, { ...b, at: 101 }, { ...a }]);
  expect(more).toHaveLength(4);
  for (const m of moved) expect(more).toContain(m);
  expect(outfit.wear({ ...bare, tape: [{ ...a }, c, { ...b, at: 101 }] })).toBe(false); // order says nothing
  const last = of([a]);
  expect(new Set(last)).toEqual(new Set(kept));
  expect(gone).toHaveLength(1);
});

test('two pieces alike are two pieces: one leaves, the other stays', async () => {
  const { root, outfit } = await wardrobe();
  const [a, b] = [tape('l', 100), tape('r', 250)];
  const on = (list: TapePiece[]) => { outfit.wear({ ...bare, tape: list }); return named(root, 'tape'); };
  const two = on([a, b, { ...a }]);
  expect(two).toHaveLength(3);
  expect(outfit.wear({ ...bare, tape: [{ ...a }, { ...a }, b] })).toBe(false);
  const one = on([b, a]);
  expect(one).toHaveLength(2);
  for (const m of one) expect(two).toContain(m);
  const again = on([a, a, b]);
  expect(again).toHaveLength(3);
  for (const m of one) expect(again).toContain(m);
  expect(on([])).toEqual([]);
});

test.each(RACQUETS)('%s: the balance marker goes round the racquet at its height', async (id) => {
  const { root, outfit } = await wardrobe(id);
  for (const mm of [120, 260, 320, 400]) {
    outfit.wear({ ...bare, balanceMm: mm });
    const b = boxOf(marker(root)!);
    expect((b.min.y + b.max.y) / 2).toBeCloseTo(mm / 1000, 6);
    expect(b.max.y - b.min.y).toBeLessThan(0.005);
    for (const name of ['frame', 'collar', 'grip']) {
      const at = new Box3();
      for (const p of verticesNear(part(root, name), mm / 1000, 0.002)) at.expandByPoint(p);
      if (at.isEmpty()) continue;
      for (const axis of ['x', 'z'] as const) {
        expect(b.max[axis]).toBeGreaterThan(at.max[axis]);
        expect(b.min[axis]).toBeLessThan(at.min[axis]);
        expect(b.max[axis] - at.max[axis]).toBeLessThan(0.06); // snug, not a hoop
      }
    }
  }
});

function verticesNear(mesh: Mesh, y: number, within: number): Vector3[] {
  mesh.updateMatrix();
  const pos = mesh.geometry.getAttribute('position');
  return Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix)).filter((p) => Math.abs(p.y - y) < within);
}

test('the marker is on a layer of its own: no light, no shadow, no pick ray meets it', async () => {
  const { root, outfit } = await wardrobe();
  outfit.wear({ ...bare, balanceMm: 320 });
  const m = marker(root)!;
  expect(m.layers.isEnabled(0)).toBe(false);
  expect(m.layers.isEnabled(MARKER_LAYER)).toBe(true);
  expect([m.castShadow, m.receiveShadow]).toEqual([false, false]);
  root.updateMatrixWorld(true);
  const b = boxOf(m);
  const ray = new Raycaster(new Vector3(b.max.x - 0.0005, 0.32, 1), new Vector3(0, 0, -1));
  expect(ray.intersectObject(root, true)).toEqual([]);
  expect(outfit.marked).toBe(true);
  // Moving it is a change; asking for the same, or for another place it cannot be, is not.
  expect(outfit.wear({ ...bare, balanceMm: 321 })).toBe(true);
  expect(outfit.wear({ ...bare, balanceMm: 321 })).toBe(false);
  expect([outfit.wear({ ...bare, balanceMm: 5000 }), outfit.wear({ ...bare, balanceMm: 6000 }), outfit.wear(bare)]).toEqual([true, false, false]);
  // Off the racquet there is nothing to mark; a bad number neither.
  for (const balanceMm of [5000, -50, NaN, null]) {
    outfit.wear({ ...bare, balanceMm: 320 });
    outfit.wear({ ...bare, balanceMm });
    expect([marker(root), outfit.marked]).toEqual([undefined, false]);
  }
});

test('surfaceUnder finds the frame, collar or grip through strings, tape and trim', async () => {
  const { root, outfit } = await wardrobe();
  const beds = bedLines(root)!;
  outfit.wear({ ...all(), tape: [tape('r', 100, { lengthMm: 60 }), tape('h', 0)] });
  root.position.set(1, 2, 3); // a model need not stand at the origin
  root.scale.setScalar(2);
  const down = (x: number, y: number, dx: number, dy: number) => {
    const ray = new Raycaster(new Vector3(x, y, 0).multiplyScalar(2).add(root.position), new Vector3(dx, dy, 0).normalize());
    return surfaceUnder(root, ray);
  };
  const on = down(0.3, 0.1, -1, 0)!; // through the tape on the handle's right side
  expect(on.y).toBeCloseTo(0.1, 6);
  expect(on.x).toBeCloseTo(placeTape(root, beds, tape('r', 100))[0].path[10].x, 2);
  expect(down(0, 1, 0, -1)!.y).toBeGreaterThan(0.6); // the top of the hoop, under its bumper
  const ray = new Raycaster(new Vector3(0, 0.5, 1).multiplyScalar(2).add(root.position), new Vector3(0, 0, -1));
  expect(surfaceUnder(root, ray)).toBeNull(); // straight through the string bed
  expect(new OrthographicCamera().layers.isEnabled(MARKER_LAYER)).toBe(false); // the alcove's light sees no marker
});

test('strings restrung under tape and grip leave those alone, and colours are read as sRGB', async () => {
  const { root, outfit } = await wardrobe();
  outfit.wear(all());
  const mat = (n: string) => part(root, n).material as MeshStandardMaterial;
  expect(mat('strings_mains').color.equals(new Color('#111111'))).toBe(true);
  expect(mat('strings_crosses').color.equals(new Color('#ffd400'))).toBe(true);
  outfit.wear({ ...all(), strings: null });
  expect(named(root, 'tape')).toHaveLength(3);
  expect(mat('grip').color.getHexString()).toBe('ffffff');
});

test('a spool has no strings to wear anything on; a racquet shown in other colours is dressed and gets them back', async () => {
  expect(bedLines(await load('models/string-spool.glb'))).toBeNull();
  const source = await load(`realistic/${PURE_AERO}.glb`);
  const root = tinted(source, { grip: '#00ff00', strings_mains: '#ff00ff' });
  const before = snap(root);
  const outfit = new Outfit(root, bedLines(root)!);
  outfit.wear(all());
  expect((part(root, 'grip').material as MeshStandardMaterial).color.getHexString()).toBe('ffffff');
  outfit.wear(null);
  expect(snap(root)).toEqual(before);
  expect((part(root, 'grip').material as MeshStandardMaterial).color.getHexString()).toBe('00ff00');
});
