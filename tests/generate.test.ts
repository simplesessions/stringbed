import { test, expect } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllSpecs } from '../src/core/spec';
import type { Catalog } from '../src/catalog';
import { generateAll } from '../scripts/generate';

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
