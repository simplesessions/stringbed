import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Catalog, StringCatalog } from '../src/catalog';
import { buildSpool } from '../src/core/spool';
import { hexToLinear } from '../src/core/color';
import { partsToGlb } from '../src/export/glb';
import { loadAllStrings } from '../src/string-spec';
import { buildRacquet, triangleCount } from '../src/core/build';
import { lineageOf, loadAllSpecs, withColourway, type RacquetSpec } from '../src/core/spec';
import { loadPlaceholders } from '../src/placeholders';
import { styles } from '../src/styles';
import { ROUGHNESS } from '../src/styles/finish';

export const MAX_BYTES = 150 * 1024;
export const SPOOL_MAX_BYTES = 40 * 1024;
/** Size limit by the kind of file: the spool is not a racquet style. */
const maxBytes = (style: string) => (style === 'models' ? SPOOL_MAX_BYTES : MAX_BYTES);
const SPOOL_PATH = 'models/string-spool.glb';
/** Folders generate owns outright: stale files in them are removed. */
const OWNED_DIRS = [...styles.map((s) => s.id), 'models'];

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
    files: [],
    placeholders: loadPlaceholders().map(({ status: _s, notes: _n, verified: _v, ...p }) => p),
  };
  /** Build one spec (a racquet or one of its colourways) into every style; file stem `stem`. */
  const render = async (spec: RacquetSpec, stem: string) => {
    const model = buildRacquet(spec);
    const triangles = triangleCount(model);
    const assets: Catalog['racquets'][number]['assets'] = {};
    for (const style of styles) {
      const bytes = await style.render(model);
      const path = `${style.id}/${stem}.${style.extension}`;
      files.set(path, bytes);
      assets[style.id] = { path, bytes: bytes.byteLength, triangles };
      rows.push({ id: stem, triangles, bytes: bytes.byteLength, style: style.id });
    }
    return { model, assets };
  };
  for (const spec of specs) {
    const { model, assets } = await render(spec, spec.id);
    const colourways: NonNullable<Catalog['racquets'][number]['colourways']> = [];
    for (const cw of spec.colourways ?? []) {
      const { assets: cwAssets } = await render(withColourway(spec, cw), `${spec.id}--${cw.id}`);
      colourways.push({ id: cw.id, name: cw.name, ...(cw.year ? { year: cw.year } : {}), swatch: cw.paint.base, assets: cwAssets });
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
      lineage: lineageOf(spec),
      ...(spec.variantLabel ? { variantLabel: spec.variantLabel } : {}),
      ...(spec.variantOf ? { variantOf: spec.variantOf } : {}),
      ...(spec.variants?.length ? { variants: [{ id: spec.id, label: spec.variantLabel ?? spec.model }, ...spec.variants.map((v) => ({ id: v.id, label: v.label }))] } : {}),
      ...(spec.colourway ? { colourway: spec.colourway } : {}),
      ...(colourways.length ? { colourways } : {}),
    });
  }
  for (const r of catalog.racquets) {
    const row = { id: r.id, brand: r.brand, line: r.line, lineage: r.lineage, model: r.model, generation: r.generation, year: r.year, variant: r.variantLabel ?? null };
    for (const [style, a] of Object.entries(r.assets)) {
      catalog.files.push({ ...row, colourway: null, colourwayName: r.colourway ?? null, style, path: a.path, bytes: a.bytes });
    }
    for (const cw of r.colourways ?? []) {
      for (const [style, a] of Object.entries(cw.assets)) {
        catalog.files.push({ ...row, colourway: cw.id, colourwayName: cw.name, style, path: a.path, bytes: a.bytes });
      }
    }
  }
  const spool = buildSpool();
  const spoolBytes = await partsToGlb('string-spool', spool, (part) => ({ baseColor: hexToLinear(part.surface.color), metallic: 0, roughness: ROUGHNESS.satin }));
  const spoolTriangles = spool.reduce((n, p) => n + p.geometry.index!.count / 3, 0);
  files.set(SPOOL_PATH, spoolBytes);
  rows.push({ id: 'string-spool', triangles: spoolTriangles, bytes: spoolBytes.byteLength, style: 'models' });
  const strings: StringCatalog = { version: 1, spool: { path: SPOOL_PATH, bytes: spoolBytes.byteLength, triangles: spoolTriangles, parts: spool.map((p) => p.name) }, strings: loadAllStrings() };
  files.set('strings.json', new TextEncoder().encode(JSON.stringify(strings, null, 2) + '\n'));
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
  for (const id of OWNED_DIRS) {
    const dir = join(outDir, id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!gen.files.has(`${id}/${f}`)) rmSync(join(dir, f), { recursive: true, force: true });
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
  for (const id of OWNED_DIRS) {
    const dir = join(outDir, id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (!gen.files.has(`${id}/${f}`)) diffs.push(`${id}/${f}`);
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
  const over = gen.rows.filter((r) => r.bytes > maxBytes(r.style));
  if (over.length > 0) {
    for (const r of over) console.error(`${r.style}/${r.id}: ${r.bytes} bytes exceeds ${maxBytes(r.style)}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
