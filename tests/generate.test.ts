import { test, expect } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllSpecs } from '../src/core/spec';
import type { Catalog, StringCatalog } from '../src/catalog';
import { loadAllStrings } from '../src/string-spec';
import { diffAgainstDisk, generateAll, generateInMemory } from '../scripts/generate';

test('catalog lists every spec with an asset per style', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stringbed-'));
  await generateAll(dir);
  const catalog: Catalog = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8'));
  expect(catalog.racquets).toHaveLength(loadAllSpecs().length);
  for (const r of catalog.racquets) {
    const a = r.assets.realistic;
    expect(existsSync(join(dir, a.path))).toBe(true);
    expect(statSync(join(dir, a.path)).size).toBe(a.bytes);
  }
}, 120_000);

test('strings.json lists every string in loader order, and the spool it names exists', async () => {
  const gen = await generateInMemory();
  const c: StringCatalog = JSON.parse(new TextDecoder().decode(gen.files.get('strings.json')));
  expect(c.version).toBe(1); expect(c.strings).toEqual(loadAllStrings());
  expect(c.spool.path).toBe('models/string-spool.glb');
  expect(gen.files.get(c.spool.path)!.byteLength).toBe(c.spool.bytes);
  expect(c.spool.bytes).toBeLessThanOrEqual(40 * 1024);
  expect(c.spool.parts).toEqual(['spool', 'spool_string']);
}, 120_000);

test('generating twice gives the same spool bytes', async () => {
  const a = (await generateInMemory()).files.get('models/string-spool.glb')!;
  const b = (await generateInMemory()).files.get('models/string-spool.glb')!;
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
}, 240_000);

test('a stray file in a generated folder is reported and removed, and a file outside them is left alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stringbed-'));
  const gen = await generateAll(dir);
  expect(diffAgainstDisk(gen, dir)).toEqual([]);
  mkdirSync(join(dir, 'models'), { recursive: true });
  writeFileSync(join(dir, 'models/stray.glb'), 'x');
  writeFileSync(join(dir, 'realistic/stray.glb'), 'x');
  writeFileSync(join(dir, 'notes.txt'), 'mine');
  expect(diffAgainstDisk(gen, dir)).toEqual(['models/stray.glb', 'realistic/stray.glb']);
  await generateAll(dir);
  expect(existsSync(join(dir, 'models/stray.glb'))).toBe(false);
  expect(existsSync(join(dir, 'realistic/stray.glb'))).toBe(false);
  expect(readFileSync(join(dir, 'notes.txt'), 'utf8')).toBe('mine');
  expect(existsSync(join(dir, 'models/string-spool.glb'))).toBe(true);
  expect(diffAgainstDisk(gen, dir)).toEqual([]);
}, 240_000);
