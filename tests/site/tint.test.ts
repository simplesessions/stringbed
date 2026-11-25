import { test, expect } from 'bun:test';
import { Color, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { buildSpool } from '../../src/core/spool';
import { tinted, untint } from '../../site/src/studio';

/** The spool as a loaded file has it: one named mesh and one material per part. */
function spool(): Group {
  const g = new Group();
  for (const p of buildSpool()) {
    const m = new Mesh(p.geometry, new MeshStandardMaterial({ color: p.surface.color, roughness: 0.55 }));
    m.name = p.name;
    g.add(m);
  }
  return g;
}
const part = (o: Object3D, name: string) => o.getObjectByName(name) as Mesh<Mesh['geometry'], MeshStandardMaterial>;
const hex = (o: Object3D, name: string) => `#${part(o, name).material.color.getHexString()}`;

test('two tints of one spool differ, and leave the source as it was', () => {
  const source = spool();
  const material = part(source, 'spool_string').material;
  const before = material.color.clone();
  const yellow = tinted(source, { spool_string: '#e6d200' });
  const black = tinted(source, { spool_string: '#111111' });
  expect(hex(yellow, 'spool_string')).toBe('#e6d200');
  expect(hex(black, 'spool_string')).toBe('#111111');
  expect(part(yellow, 'spool_string').material).not.toBe(part(black, 'spool_string').material);
  expect(part(source, 'spool_string').material).toBe(material);
  expect(material.color.equals(before)).toBe(true);
});

test('everything but the named colour stays shared with the source', () => {
  const source = spool();
  const t = tinted(source, { spool_string: '#e6d200' });
  expect(part(t, 'spool').material).toBe(part(source, 'spool').material);
  expect(part(t, 'spool').geometry).toBe(part(source, 'spool').geometry);
  expect(part(t, 'spool_string').geometry).toBe(part(source, 'spool_string').geometry);
  expect(part(t, 'spool_string').material.roughness).toBe(0.55);
  expect(t).not.toBe(source);
});

test('a colour is read as sRGB, as the specs write it', () => {
  const t = tinted(spool(), { spool_string: '#808080' });
  expect(part(t, 'spool_string').material.color.r).toBeCloseTo(new Color('#808080').r, 6);
  expect(part(t, 'spool_string').material.color.r).toBeCloseTo(0.2159, 3); // linear
});

test('no colours is a plain clone, and a name the model lacks is ignored', () => {
  const source = spool();
  for (const t of [tinted(source, {}), tinted(source, { strings_mains: '#e6d200' })]) {
    for (const name of ['spool', 'spool_string']) expect(part(t, name).material).toBe(part(source, name).material);
  }
});

test('untint disposes the copies and nothing that is shared', () => {
  const source = spool();
  const disposed: string[] = [];
  const watch = (o: Object3D, tag: string) => o.traverse((m) => m instanceof Mesh && m.material.addEventListener('dispose', () => disposed.push(`${tag} ${m.name}`)));
  watch(source, 'source');
  const a = tinted(source, { spool_string: '#e6d200' });
  const b = tinted(source, { spool_string: '#111111' });
  part(a, 'spool_string').material.addEventListener('dispose', () => disposed.push('a'));
  part(b, 'spool_string').material.addEventListener('dispose', () => disposed.push('b'));
  untint(a);
  expect(disposed).toEqual(['a']);
  untint(source.clone()); // an ordinary clone holds nothing of its own
  expect(disposed).toEqual(['a']);
});
