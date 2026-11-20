import { NodeIO } from '@gltf-transform/core';
import { buildRacquet } from '../../src/core/build';
import { loadAllSpecs } from '../../src/core/spec';
import { realistic } from '../../src/styles/realistic';

const spec = loadAllSpecs()[0];

test('GLB round-trips with named nodes and materials', async () => {
  const bytes = await realistic.render(buildRacquet(spec));
  const doc = await new NodeIO().readBinary(bytes);
  const names = doc.getRoot().listNodes().map((n) => n.getName());
  expect(names).toEqual(expect.arrayContaining(['frame', 'grip', 'strings_mains', 'strings_crosses', 'butt_cap', 'collar', 'bumper', 'grommets']));
  expect(names).toContain(spec.id);
  expect(doc.getRoot().listMaterials().map((m) => m.getName())).toContain('mat_grip');
  expect(doc.getRoot().listTextures()).toHaveLength(0);
  expect(doc.getRoot().listScenes()).toHaveLength(1);
  const frame = doc.getRoot().listNodes().find((n) => n.getName() === 'frame')!;
  expect(frame.getMesh()!.listPrimitives()[0].getAttribute('COLOR_0')).not.toBeNull();
  const grip = doc.getRoot().listNodes().find((n) => n.getName() === 'grip')!;
  expect(grip.getMesh()!.listPrimitives()[0].getAttribute('COLOR_0')).toBeNull();
});

test('GLB is deterministic and under 150 KB', async () => {
  const a = await realistic.render(buildRacquet(spec));
  const b = await realistic.render(buildRacquet(spec));
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  expect(a.byteLength).toBeLessThanOrEqual(150 * 1024);
});
