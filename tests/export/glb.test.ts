import { test, expect } from 'bun:test';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { buildRacquet } from '../../src/core/build';
import { loadAllSpecs } from '../../src/core/spec';
import { modelToGlb } from '../../src/export/glb';
import { realistic } from '../../src/styles/realistic';

const spec = loadAllSpecs()[0];
const reader = () => new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

test('GLB round-trips with named nodes and materials', async () => {
  const bytes = await realistic.render(buildRacquet(spec));
  const doc = await reader().readBinary(bytes);
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

test('GLB is deterministic and under 60 KB', async () => {
  const a = await realistic.render(buildRacquet(spec));
  const b = await realistic.render(buildRacquet(spec));
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  expect(a.byteLength).toBeLessThanOrEqual(60 * 1024);
});

test('materialFor is asked once per part, even when parts share one surface', async () => {
  const model = buildRacquet(spec);
  const shared = { ...model.parts[0].surface, vertexColors: false };
  const parts = model.parts.map((p) => ({ ...p, surface: shared }));
  const asked: string[] = [];
  const bytes = await modelToGlb({ ...model, parts }, (part) => {
    asked.push(part.name);
    return { baseColor: [parts.findIndex((p) => p.name === part.name) / parts.length, 0, 0], metallic: 0, roughness: 1 };
  });
  expect(asked).toEqual(parts.map((p) => p.name));
  const doc = await reader().readBinary(bytes);
  for (const [i, p] of parts.entries()) {
    const node = doc.getRoot().listNodes().find((n) => n.getName() === p.name)!;
    expect(node.getMesh()!.listPrimitives()[0].getMaterial()!.getBaseColorFactor()[0], p.name).toBeCloseTo(i / parts.length, 5);
  }
});
