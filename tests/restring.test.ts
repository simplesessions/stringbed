import { test, expect } from 'bun:test';
import { Box3, Color, Group, Vector3, type BufferGeometry, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { computeLayout } from '../src/core/layout';
import { HOOP_RADIAL } from '../src/core/section';
import { loadAllSpecs } from '../src/core/spec';
import { buildCrosses, buildMains } from '../src/core/strings';
import { bedLines, restring, strandGeometry, type Line, type Strand } from '../src/restring';
import { catalog, load, part, points } from './models';

const PURE_AERO = 'realistic/babolat-pure-aero-100.glb';
const gut135: Strand = { color: '#e8d9a0', finish: 'gloss', gaugeMm: 1.35, sides: 0 };
const poly115: Strand = { color: '#ffd400', finish: 'matte', gaugeMm: 1.15, sides: 6 };
const tris = (root: Object3D, name: string): number => part(root, name).geometry.index!.count / 3;
const parts = ['strings_mains', 'strings_crosses'] as const;
const state = (m: Mesh) => ({ geometry: m.geometry, material: m.material, position: m.position.toArray(), quaternion: m.quaternion.toArray(), scale: m.scale.toArray(), matrix: m.matrix.toArray(), castShadow: m.castShadow, receiveShadow: m.receiveShadow });
const snap = (root: Object3D) => parts.map((n) => { part(root, n).updateMatrix(); return state(part(root, n)); });

test('every published file gives back its string pattern', async () => {
  expect(catalog.files).toHaveLength(364);
  const pattern = new Map(catalog.racquets.map((r) => [r.id, r.specs.stringPattern]));
  for (const f of catalog.files) {
    const beds = bedLines(await load(f.path))!;
    expect({ path: f.path, pattern: [beds.mains.lines.length, beds.crosses.lines.length] }).toEqual({ path: f.path, pattern: [...pattern.get(f.id)!] });
  }
}, 120_000);

test('lines match the builder to 0.05 mm', async () => {
  const beds = bedLines(await load(PURE_AERO))!;
  const spec = loadAllSpecs().find((s) => s.id === 'babolat-pure-aero-100')!;
  const layout = computeLayout(spec, HOOP_RADIAL[spec.geometry.beam.profile]);
  // Sixteen vertices a string, in the builder's own order.
  const built = (g: BufferGeometry, axis: 'x' | 'y', along: 'x' | 'y'): Line[] => {
    const pos = g.getAttribute('position');
    return Array.from({ length: pos.count / 16 }, (_, k) => {
      const b = new Box3().setFromPoints(Array.from({ length: 16 }, (_, i) => new Vector3().fromBufferAttribute(pos, 16 * k + i)));
      return { at: (b.min[axis] + b.max[axis]) / 2, from: b.min[along], to: b.max[along] };
    }).sort((a, b) => a.at - b.at);
  };
  const worst = (got: Line[], want: Line[]): number => {
    expect(got).toHaveLength(want.length);
    return Math.max(...got.flatMap((l, i) => [l.at - want[i].at, l.from - want[i].from, l.to - want[i].to]).map(Math.abs));
  };
  expect(worst(beds.mains.lines, built(buildMains(spec, layout), 'x', 'y'))).toBeLessThan(0.00005);
  expect(worst(beds.crosses.lines, built(buildCrosses(spec, layout), 'y', 'x'))).toBeLessThan(0.00005);
  expect(beds.mains.z).toBeCloseTo(0.0003, 5);
  expect(beds.crosses.z).toBeCloseTo(-0.0003, 5);
});

test('restrung meshes are gauge thick, in racquet space, under budget', async () => {
  const root = await load(PURE_AERO);
  const before = new Box3().setFromObject(root.getObjectByName('strings_mains')!);
  const beforeX = new Box3().setFromObject(root.getObjectByName('strings_crosses')!);
  restring(root, gut135, poly115);
  const mains = root.getObjectByName('strings_mains') as Mesh;
  const after = new Box3().setFromObject(mains);
  expect(after.max.z - after.min.z).toBeCloseTo(0.00135, 5);
  expect(after.min.y).toBeCloseTo(before.min.y, 4); expect(after.max.y).toBeCloseTo(before.max.y, 4);
  expect(mains.scale.x).toBe(1);
  expect(mains.position.toArray()).toEqual([0, 0, 0]);
  expect(tris(root, 'strings_mains') + tris(root, 'strings_crosses')).toBeLessThanOrEqual(1500);
  const crosses = new Box3().setFromObject(part(root, 'strings_crosses'));
  expect(crosses.min.x).toBeCloseTo(beforeX.min.x, 4); expect(crosses.max.x).toBeCloseTo(beforeX.max.x, 4);
  // Six sides, one facing +Z: flat to flat is the gauge times cos 30.
  expect(crosses.max.z - crosses.min.z).toBeCloseTo(0.00115 * Math.cos(Math.PI / 6), 5);
  const material = part(root, 'strings_crosses').material as MeshStandardMaterial;
  expect(material.isMeshStandardMaterial).toBe(true);
  expect(material.color.equals(new Color('#ffd400'))).toBe(true);
  expect(material.roughness).toBe(0.85);
  expect((mains.material as MeshStandardMaterial).roughness).toBe(0.25);
});

test('crosses left out are strung as the mains are', async () => {
  const root = await load(PURE_AERO);
  restring(root, poly115);
  const [m, x] = parts.map((n) => part(root, n));
  expect((x.material as MeshStandardMaterial).color.equals((m.material as MeshStandardMaterial).color)).toBe(true);
  const [mb, xb] = [m, x].map((o) => new Box3().setFromObject(o));
  expect(xb.max.z - xb.min.z).toBeCloseTo(mb.max.z - mb.min.z, 9);
});

test('names and shadow flags stay', async () => {
  const root = await load(PURE_AERO);
  for (const n of parts) { part(root, n).castShadow = true; part(root, n).receiveShadow = false; }
  restring(root, gut135, poly115);
  for (const n of parts) expect([part(root, n).name, part(root, n).castShadow, part(root, n).receiveShadow]).toEqual([n, true, false]);
});

test('the source a clone came from keeps its geometry, material and colour', async () => {
  const source = await load(PURE_AERO);
  const before = snap(source);
  const colours = parts.map((n) => (part(source, n).material as MeshStandardMaterial).color.getHex());
  const clone = source.clone();
  restring(clone, gut135, poly115);
  expect(snap(source)).toEqual(before);
  parts.forEach((n, i) => {
    expect(part(source, n).geometry).toBe(before[i].geometry);
    expect(part(source, n).material).toBe(before[i].material);
    expect((part(source, n).material as MeshStandardMaterial).color.getHex()).toBe(colours[i]);
    expect(part(clone, n).geometry).not.toBe(part(source, n).geometry);
    expect(part(clone, n).material).not.toBe(part(source, n).material);
  });
});

const countDisposals = (root: Object3D): { count: () => number } => {
  let n = 0;
  for (const name of parts) {
    part(root, name).geometry.addEventListener('dispose', () => n++);
    (part(root, name).material as MeshStandardMaterial).addEventListener('dispose', () => n++);
  }
  return { count: () => n };
};

test('undo restores everything, disposes only its own, and is a no-op twice', async () => {
  const root = await load(PURE_AERO);
  const before = snap(root);
  const originals = countDisposals(root);
  const undo = restring(root, gut135, poly115)!;
  const own = countDisposals(root);
  undo();
  const after = snap(root);
  expect(after).toEqual(before);
  after.forEach((a, i) => { expect(a.geometry).toBe(before[i].geometry); expect(a.material).toBe(before[i].material); });
  expect(own.count()).toBe(4);
  undo();
  expect(own.count()).toBe(4);
  expect(originals.count()).toBe(0);
});

test('restringing twice keeps the last choice, and an earlier undo no longer does anything', async () => {
  const root = await load(PURE_AERO);
  const before = snap(root);
  const first = restring(root, gut135)!;
  const gone = countDisposals(root);
  const second = restring(root, poly115)!;
  expect(gone.count()).toBe(4);
  first();
  expect((part(root, 'strings_mains').material as MeshStandardMaterial).color.equals(new Color('#ffd400'))).toBe(true);
  second();
  snap(root).forEach((a, i) => { expect(a.geometry).toBe(before[i].geometry); expect(a.material).toBe(before[i].material); });
});

test('lines are read from the original strings, restrung or not', async () => {
  const root = await load(PURE_AERO);
  const before = bedLines(root)!;
  const undo = restring(root, { ...gut135, gaugeMm: 2 }, poly115)!;
  expect(bedLines(root)).toEqual(before);
  const g = part(root, 'strings_mains').geometry;
  restring(root, { ...gut135, gaugeMm: 2 }, poly115);
  expect([...part(root, 'strings_mains').geometry.getAttribute('position').array]).toEqual([...g.getAttribute('position').array]);
  undo();
});

test('another root over the same meshes, and a clone, still know the originals', async () => {
  const root = await load(PURE_AERO);
  const before = snap(root);
  const lines = bedLines(root);
  const first = restring(root, gut135)!;
  const inner = part(root, 'strings_mains').parent!;
  expect(inner).not.toBe(root);
  expect(bedLines(inner)).toEqual(lines);
  const clone = root.clone();
  expect(bedLines(clone)).toEqual(lines);
  const second = restring(inner, poly115)!; // takes the place of the first
  first();
  expect((part(root, 'strings_mains').material as MeshStandardMaterial).color.equals(new Color('#ffd400'))).toBe(true);
  second();
  snap(root).forEach((a, i) => { expect(a.geometry).toBe(before[i].geometry); expect(a.material).toBe(before[i].material); });
  // A clone taken while restrung goes back to stock too.
  restring(clone, poly115)!();
  snap(clone).forEach((a, i) => { expect(a.geometry).toBe(before[i].geometry); expect(a.material).toBe(before[i].material); expect(a.matrix).toEqual(before[i].matrix); });
});

test('a model without string parts gives null', async () => {
  const root = await load(PURE_AERO);
  part(root, 'strings_crosses').removeFromParent();
  expect(bedLines(root)).toBeNull();
  const mains = part(root, 'strings_mains').geometry;
  expect(restring(root, gut135)).toBeNull();
  expect(part(root, 'strings_mains').geometry).toBe(mains);
  expect(bedLines(new Group())).toBeNull();
});

test('faces point outward, round and six-sided', () => {
  const bed = { lines: [{ at: 0.02, from: 0.3, to: 0.6 }], z: 0.0003 };
  for (const axis of ['mains', 'crosses'] as const) for (const strand of [gut135, poly115]) {
    const g = strandGeometry(bed, axis, strand);
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), idx = g.index!;
    const at = (a: typeof pos, i: number) => new Vector3().fromBufferAttribute(a, i);
    // From the string's axis to a point: what "outward" means here.
    const outward = (v: Vector3) => axis === 'mains' ? new Vector3(v.x - 0.02, 0, v.z - bed.z) : new Vector3(0, v.y - 0.02, v.z - bed.z);
    expect(idx.count).toBe(6 * (strand.sides || 8));
    for (let i = 0; i < idx.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => at(pos, idx.getX(i + k)));
      const face = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      expect(face.dot(outward(a.clone().add(b).add(c).divideScalar(3)).normalize())).toBeGreaterThan(0.9);
      for (let k = 0; k < 3; k++) {
        const n = at(nor, idx.getX(i + k));
        if (strand.sides) expect(n.distanceTo(face)).toBeLessThan(1e-4); // flat
        else expect(n.distanceTo(outward(at(pos, idx.getX(i + k))).normalize())).toBeLessThan(1e-4); // radial
      }
    }
    if (strand.sides) expect([...Array(nor.count)].some((_, i) => nor.getZ(i) > 0.9999)).toBe(true);
    const r = Math.max(...[...Array(pos.count)].map((_, i) => outward(at(pos, i)).length()));
    expect(2 * r).toBeCloseTo(strand.gaugeMm / 1000, 7);
  }
});

test('the widest published bed with the most sides stays under budget', async () => {
  const biggest = [...catalog.racquets].sort((a, b) => b.specs.stringPattern[0] + b.specs.stringPattern[1] - a.specs.stringPattern[0] - a.specs.stringPattern[1])[0];
  const root = await load(biggest.assets.realistic.path);
  restring(root, { ...poly115, sides: 12 });
  expect(tris(root, 'strings_mains') + tris(root, 'strings_crosses')).toBeLessThanOrEqual(1500);
});

test('the strings read back lie where the file puts them', async () => {
  const root = await load(PURE_AERO);
  const b = new Box3().setFromPoints(points(part(root, 'strings_mains')));
  const { lines } = bedLines(root)!.mains;
  expect(Math.min(...lines.map((l) => l.from))).toBeCloseTo(b.min.y, 9);
  expect(Math.max(...lines.map((l) => l.to))).toBeCloseTo(b.max.y, 9);
});
