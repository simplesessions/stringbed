import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Catalog } from '../src/catalog';
import { buildRacquet, triangleCount } from '../src/core/build';
import { loadAllSpecs } from '../src/core/spec';
import { styles } from '../src/styles';

export const MAX_BYTES = 150 * 1024;

export interface Generated {
  /** Relative path (forward slashes) to file content. */
  files: Map<string, Uint8Array>;
  catalog: Catalog;
  rows: Array<{ id: string; triangles: number; bytes: number; style: string }>;
}

export async function generateInMemory(): Promise<Generated> {
  const specs = loadAllSpecs();
  const files = new Map<string, Uint8Array>();
  const rows: Generated['rows'] = [];
  const catalog: Catalog = {
    version: 1,
    styles: styles.map((s) => ({ id: s.id, kind: s.kind, label: s.label, extension: s.extension })),
    racquets: [],
  };
  for (const spec of specs) {
    const model = buildRacquet(spec);
    const triangles = triangleCount(model);
    const assets: Catalog['racquets'][number]['assets'] = {};
    for (const style of styles) {
      const bytes = await style.render(model);
      const path = `${style.id}/${spec.id}.${style.extension}`;
      files.set(path, bytes);
      assets[style.id] = { path, bytes: bytes.byteLength, triangles };
      rows.push({ id: spec.id, triangles, bytes: bytes.byteLength, style: style.id });
    }
    catalog.racquets.push({
      id: spec.id,
      brand: spec.brand,
      line: spec.line,
      model: spec.model,
      generation: spec.generation,
      year: spec.year,
      specs: spec.specs,
      swatch: spec.paint.base,
      parts: model.parts.map((p) => p.name),
      assets,
    });
  }
  files.set('catalog.json', new TextEncoder().encode(JSON.stringify(catalog, null, 2) + '\n'));
  return { files, catalog, rows };
}

/** Write every asset and catalog.json into outDir, removing stale files in each style directory. */
export async function generateAll(outDir: string): Promise<Generated> {
  const gen = await generateInMemory();
  for (const [path, bytes] of gen.files) {
    const full = join(outDir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  }
  for (const style of styles) {
    const dir = join(outDir, style.id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!gen.files.has(`${style.id}/${f}`)) rmSync(join(dir, f), { recursive: true, force: true });
    }
  }
  return gen;
}

/** Paths that differ between the in-memory output and what is on disk (missing, changed or extra). */
export function diffAgainstDisk(gen: Generated, outDir: string): string[] {
  const diffs: string[] = [];
  for (const [path, bytes] of gen.files) {
    const full = join(outDir, path);
    if (!existsSync(full) || !Buffer.from(bytes).equals(readFileSync(full))) diffs.push(path);
  }
  for (const style of styles) {
    const dir = join(outDir, style.id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (!gen.files.has(`${style.id}/${f}`)) diffs.push(`${style.id}/${f}`);
  }
  return diffs.sort();
}

function printTable(rows: Generated['rows']): void {
  const w = Math.max(2, ...rows.map((r) => r.id.length));
  console.log(`${'id'.padEnd(w)}  style      triangles     bytes`);
  for (const r of rows) console.log(`${r.id.padEnd(w)}  ${r.style.padEnd(9)} ${String(r.triangles).padStart(10)} ${String(r.bytes).padStart(9)}`);
}

async function main(): Promise<number> {
  const check = process.argv.includes('--check');
  const outDir = 'assets';
  if (check) {
    const gen = await generateInMemory();
    const diffs = diffAgainstDisk(gen, outDir);
    if (diffs.length > 0) {
      console.error(`assets/ is out of date (${diffs.length} differing paths):`);
      for (const d of diffs) console.error(`  ${d}`);
      return 1;
    }
    console.log('assets/ is up to date');
    return 0;
  }
  const gen = await generateAll(outDir);
  printTable(gen.rows);
  const over = gen.rows.filter((r) => r.bytes > MAX_BYTES);
  if (over.length > 0) {
    for (const r of over) console.error(`${r.style}/${r.id}: ${r.bytes} bytes exceeds ${MAX_BYTES}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
