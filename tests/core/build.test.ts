import { test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { buildRacquet, triangleCount, type RacquetModel } from '../../src/core/build';
import { headOutline } from '../../src/core/outline';
import { makeSpec } from '../fixtures';
import { loadAllSpecs, type RacquetSpec } from '../../src/core/spec';
import { inToM } from '../../src/core/units';

const specs = loadAllSpecs();

function unionBox(m: RacquetModel): THREE.Box3 {
  const b = new THREE.Box3();
  for (const p of m.parts) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox!); }
  return b;
}

test.each(specs)('$id builds within budget', (spec) => {
  const m = buildRacquet(spec);
  expect(m.parts.map((p) => p.name)).toEqual(['frame', 'bumper', 'grommets', 'strings_mains', 'strings_crosses', 'grip', 'collar', 'butt_cap']);
  expect(triangleCount(m)).toBeLessThanOrEqual(15000);
  const box = unionBox(m);
  expect(box.min.y).toBeCloseTo(0, 4);
  expect(box.max.y).toBeCloseTo(inToM(spec.specs.lengthIn), 3);
  expect(box.min.x).toBeCloseTo(-box.max.x, 3);
  for (const p of m.parts) {
    expect(p.geometry.index).not.toBeNull();
    expect(p.geometry.getAttribute('normal')).toBeDefined();
    expect(p.geometry.getAttribute('uv')).toBeUndefined();
    for (const name of Object.keys(p.geometry.attributes)) for (const v of p.geometry.getAttribute(name).array) expect(Number.isFinite(v)).toBe(true);
  }
});

test.each(specs)('$id surfaces follow the rules', (spec) => {
  const m = buildRacquet(spec);
  const by = Object.fromEntries(m.parts.map((p) => [p.name, p]));
  expect(by.frame.surface).toEqual({ color: '#ffffff', finish: spec.paint.finish, vertexColors: true });
  expect(by.frame.geometry.getAttribute('color')).toBeDefined();
  expect(by.grip.surface).toEqual({ color: spec.parts.grip.color, finish: 'matte', vertexColors: false });
  expect(by.strings_mains.surface.color).toBe(spec.parts.strings.color);
  expect(by.strings_crosses.surface.color).toBe(spec.parts.strings.color);
  expect(by.butt_cap.surface.color).toBe(spec.parts.buttCap.color);
  const hasColor = by.grommets.geometry.getAttribute('color') !== undefined;
  expect(by.grommets.surface.vertexColors).toBe(hasColor);
  expect(by.grommets.surface.color).toBe(hasColor ? '#ffffff' : spec.parts.grommets.color);
});

test('dampener is appended when present', () => {
  const s: RacquetSpec = { ...specs[0], parts: { ...specs[0].parts, dampener: { color: '#111111' } } };
  const m = buildRacquet(s);
  expect(m.parts[m.parts.length - 1].name).toBe('dampener');
  expect(m.parts[m.parts.length - 1].surface.color).toBe('#111111');
});

test('build is deterministic', () => {
  const a = buildRacquet(specs[0]), b = buildRacquet(specs[0]);
  expect(Array.from(a.parts[0].geometry.getAttribute('position').array)).toEqual(Array.from(b.parts[0].geometry.getAttribute('position').array));
});

function signature(s: RacquetSpec): string {
  const loop = headOutline(s.geometry.head.shape, s.specs.headSizeSqIn, s.geometry.head.aspect, 256);
  const xs = loop.map((p) => p.x), ys = loop.map((p) => p.y);
  const widthMm = Math.round((Math.max(...xs) - Math.min(...xs)) * 1000);
  const lengthMm = Math.round((Math.max(...ys) - Math.min(...ys)) * 1000);
  const frame = buildRacquet(s).parts[0].geometry;
  frame.computeBoundingBox();
  const zMm = Math.round((frame.boundingBox!.max.z - frame.boundingBox!.min.z) * 2000) / 2; // 0.5 mm steps
  return JSON.stringify([widthMm, lengthMm, zMm, s.geometry.head.shape, s.geometry.beam.profile]);
}
function visiblyDifferent(a: RacquetSpec, b: RacquetSpec): boolean {
  return (
    a.geometry.head.shape !== b.geometry.head.shape ||
    a.geometry.beam.profile !== b.geometry.beam.profile ||
    a.geometry.throat.style !== b.geometry.throat.style ||
    a.geometry.throat.bridge !== b.geometry.throat.bridge ||
    Math.abs(a.specs.headSizeSqIn - b.specs.headSizeSqIn) >= 2 ||
    Math.abs(a.geometry.head.aspect - b.geometry.head.aspect) >= 0.03 ||
    a.specs.beamMm.some((v, i) => Math.abs(v - b.specs.beamMm[i]) >= 1)
  );
}

test('no two racquets with visibly different geometry share a silhouette', () => {
  const sigs = new Map<string, string>(); // building a frame is slow; do it once per spec
  const sig = (s: RacquetSpec) => { if (!sigs.has(s.id)) sigs.set(s.id, signature(s)); return sigs.get(s.id)!; };
  for (let i = 0; i < specs.length; i++) for (let j = i + 1; j < specs.length; j++) {
    if (!visiblyDifferent(specs[i], specs[j])) continue;
    expect(sig(specs[i]), `${specs[i].id} vs ${specs[j].id}`).not.toBe(sig(specs[j]));
  }
});

test('the silhouette signature is not vacuous: beam mid 21 vs 26 mm differ', () => {
  const thin = makeSpec({ specs: { beamMm: [21, 21, 21] } });
  const thick = makeSpec({ specs: { beamMm: [26, 26, 26] } });
  expect(visiblyDifferent(thin, thick)).toBe(true);
  expect(signature(thin)).not.toBe(signature(thick));
});

test('core does not import styles, export or site', () => {
  const dir = 'src/core';
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    const specifiers = [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const sp of specifiers) {
      expect(sp, `${f} imports ${sp}`).not.toMatch(/\/styles|\/export|site\//);
      expect(sp, `${f} imports ${sp}`).not.toMatch(/^\.\.?\/(styles|export)/);
    }
  }
});
