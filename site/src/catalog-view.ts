// Pure view logic for the gallery. No DOM, no three.js: everything here is unit-tested.
import type { Catalog } from '../../src/catalog';

export type Racquet = Catalog['racquets'][number];
export type Style = Catalog['styles'][number];
export type Asset = Racquet['assets'][string];
export interface BrandGroup {
  brand: string;
  racquets: Racquet[];
}

/** The one place the gallery names a style. Everything else reads styles from the catalog. */
export const DEFAULT_STYLE = 'realistic';

const byText = (a: string, b: string) => a.localeCompare(b, 'en');

/** The wall's name for a racquet: the line when it is a family of variants, else the model. */
export function wallName(r: Racquet): string {
  return r.variants?.length ? r.line : r.model;
}

/** The family's main entry for a variant (or the racquet itself). */
export function familyOf(c: Catalog, r: Racquet): Racquet {
  return (r.variantOf && c.racquets.find((x) => x.id === r.variantOf)) || r;
}

/** Brands alphabetical; families alphabetical within a brand. Variants are left out. */
export function groupByBrand(c: Catalog): BrandGroup[] {
  const groups = new Map<string, Racquet[]>();
  for (const r of c.racquets) {
    if (r.variantOf) continue; // variants live on their family's page, not on the wall
    const list = groups.get(r.brand) ?? [];
    list.push(r);
    groups.set(r.brand, list);
  }
  return [...groups.keys()].sort(byText).map((brand) => ({
    brand,
    racquets: [...groups.get(brand)!].sort((a, b) => byText(wallName(a), wallName(b))),
  }));
}

export function filterByBrand(groups: BrandGroup[], brand: string | null): BrandGroup[] {
  return brand === null ? groups : groups.filter((g) => g.brand === brand);
}

/** Join Vite's BASE_URL with a catalog path, e.g. ('/stringbed/', 'realistic/x.glb'). */
export function assetUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

const ROUTE = /^#\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?\/?$/;

/** "#/<racquet>" or "#/<racquet>/<colourway>". */
export function parseRoute(hash: string): { racquetId: string | null; colourway: string | null } {
  const m = ROUTE.exec(hash);
  return { racquetId: m ? m[1] : null, colourway: m?.[2] ?? null };
}

export function routeFor(racquetId: string | null, colourway?: string | null): string {
  return racquetId === null ? '#/' : colourway ? `#/${racquetId}/${colourway}` : `#/${racquetId}`;
}

/**
 * The racquet as shown in one of its colourways: that swatch and those files, everything else
 * shared. Unknown or missing colourway: the racquet itself.
 */
export function inColourway(r: Racquet, colourway: string | null): { shown: Racquet; colourway: string | null } {
  const cw = colourway ? r.colourways?.find((c) => c.id === colourway) : undefined;
  return cw ? { shown: { ...r, swatch: cw.swatch, assets: cw.assets, colourway: cw.name }, colourway: cw.id } : { shown: r, colourway: null };
}

/** The requested style if the catalog has it, else the default style, else the first listed. */
export function pickStyle(c: Catalog, requested: string | null): Style | null {
  return (
    c.styles.find((s) => s.id === requested) ??
    c.styles.find((s) => s.id === DEFAULT_STYLE) ??
    c.styles[0] ??
    null
  );
}

export function assetFor(r: Racquet, styleId: string): Asset | null {
  return Object.hasOwn(r.assets, styleId) ? r.assets[styleId] : null;
}

export function fileNameFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function formatPattern([mains, crosses]: readonly number[]): string {
  return `${mains} × ${crosses}`;
}

export function generationLabel(r: Pick<Racquet, 'generation' | 'year'>): string {
  return r.generation === String(r.year) ? r.generation : `${r.generation}, ${r.year}`;
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

export function formatHeadSize(sqIn: number): { primary: string; secondary: string } {
  return { primary: `${trim(sqIn, 1)} in²`, secondary: `${Math.round(sqIn * 6.4516)} cm²` };
}

export function formatLength(inches: number): { primary: string; secondary: string } {
  return { primary: `${trim(inches, 2)} in`, secondary: `${trim(inches * 2.54, 1)} cm` };
}

/** Beam widths are [tip, mid, shaft]. */
export function formatBeam(beam: readonly number[]): string {
  const parts = beam.map((b) => trim(b, 1));
  return new Set(parts).size === 1 ? `${parts[0]} mm` : `${parts.join(' / ')} mm`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export type Placeholder = Catalog['placeholders'][number];
export interface StockGroup {
  brand: string;
  /** Newest sale year first; within a year, newest release first, then model. */
  years: Array<{ year: number; items: Placeholder[] }>;
  count: number;
}

/** Which racquets to show by size. Juniors are frames shorter than 27 in. */
export type Age = 'adult' | 'junior' | 'all';
export const AGES: readonly Age[] = ['adult', 'junior', 'all'];

export function matchesAge(category: 'adult' | 'junior', age: Age): boolean {
  return age === 'all' || category === age;
}

/** Racquets with no model yet, by brand, then by the latest year each was confirmed on sale. */
export function groupPlaceholders(c: Catalog, age: Age = 'all'): StockGroup[] {
  const brands = new Map<string, Map<number, Placeholder[]>>();
  for (const p of c.placeholders ?? []) {
    if (!matchesAge(p.category, age)) continue;
    const year = Math.max(...p.onSaleIn);
    const byYear = brands.get(p.brand) ?? new Map<number, Placeholder[]>();
    byYear.set(year, [...(byYear.get(year) ?? []), p]);
    brands.set(p.brand, byYear);
  }
  return [...brands.keys()].sort(byText).map((brand) => {
    const byYear = brands.get(brand)!;
    const years = [...byYear.keys()].sort((a, b) => b - a).map((year) => ({
      year,
      items: byYear.get(year)!.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || byText(a.model, b.model)),
    }));
    return { brand, years, count: years.reduce((n, y) => n + y.items.length, 0) };
  });
}

/** "Gen9, 2026", "2023 (released 2022)", "3rd Gen", "2025" or "" when nothing is known. */
export function placeholderLabel(p: Pick<Placeholder, 'generation' | 'releaseYear'>): string {
  const { generation: g, releaseYear: y } = p;
  if (g && y) return g === String(y) ? g : /^\d{4}$/.test(g) ? `${g} (released ${y})` : `${g}, ${y}`;
  return g ?? (y ? String(y) : '');
}

export interface SearchHit {
  id: string;
  brand: string;
  model: string;
  meta: string;
  hasModel: boolean;
  junior: boolean;
}

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ');

/**
 * Every query word must appear in brand, line, model, generation or year. Prefix matches on the
 * model rank first, then racquets with a 3D model, then newest. Empty query: no hits.
 */
export function searchRacquets(c: Catalog, query: string, limit = 40): SearchHit[] {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const pool: Array<SearchHit & { hay: string; model_: string; year: number }> = [
    ...c.racquets.map((r) => ({
      id: r.id, brand: r.brand, model: r.model, meta: generationLabel(r), hasModel: true, junior: false,
      hay: ` ${fold(`${r.brand} ${r.line} ${r.model} ${r.generation} ${r.year}`)} `, model_: fold(r.model), year: r.year,
    })),
    ...(c.placeholders ?? []).map((p) => ({
      id: p.id, brand: p.brand, model: p.model, meta: placeholderLabel(p), hasModel: false, junior: p.category === 'junior',
      hay: ` ${fold(`${p.brand} ${p.line} ${p.model} ${p.generation ?? ''} ${p.releaseYear ?? ''} ${p.onSaleIn.join(' ')} ${p.category === 'junior' ? 'junior' : ''}`)} `,
      model_: fold(p.model), year: p.releaseYear ?? Math.max(...p.onSaleIn) - 1,
    })),
  ];
  const score = (h: (typeof pool)[number]) => (h.model_.startsWith(words[0]) ? 0 : 1) * 2 + (h.hasModel ? 0 : 1);
  return pool
    .filter((h) => words.every((w) => h.hay.includes(` ${w}`)))
    .sort((a, b) => score(a) - score(b) || b.year - a.year || byText(a.brand, b.brand) || byText(a.model, b.model))
    .slice(0, limit)
    .map(({ id, brand, model, meta, hasModel, junior }) => ({ id, brand, model, meta, hasModel, junior }));
}

/** A junior frame: anything shorter than the adult 27 in. */
export function isJunior(r: Pick<Racquet, 'specs'>): boolean {
  return r.specs.lengthIn < 27;
}

/** Families in a lineage, newest first (year, then generation label). */
export function generationsOf(c: Catalog, family: Racquet): Racquet[] {
  return c.racquets
    .filter((r) => !r.variantOf && r.lineage === family.lineage)
    .sort((a, b) => b.year - a.year || byText(b.generation, a.generation));
}

/** True when a newer generation of the family's line is in the catalog. */
export function isOlderGeneration(c: Catalog, family: Racquet): boolean {
  return c.racquets.some((r) => !r.variantOf && r.lineage === family.lineage && r.year > family.year);
}

/** A generation's short name for a picker: "2026", "Gen 11 · 2025", "Rafa 2021". */
export function generationShort(r: Pick<Racquet, 'generation' | 'year'>): string {
  return /^\d{4}$/.test(r.generation) || r.generation.includes(String(r.year)) ? r.generation : `${r.generation} · ${r.year}`;
}

export interface WallGroup {
  brand: string;
  racquets: Racquet[];
}

/**
 * What the wall shows, by brand. Adult and All: one bay per frame family (its base), adult
 * bases only for Adult. Junior: every junior racquet, variant or not, since junior sizes often
 * live inside an adult family. Unless `older`, a family with a newer generation in its lineage
 * (and the juniors inside it) is left out. Sorted like the wall reads: by wall name.
 */
export function wallGroups(c: Catalog, age: Age, older: boolean): WallGroup[] {
  const byId = new Map(c.racquets.map((r) => [r.id, r]));
  const familyOf_ = (r: Racquet) => (r.variantOf ? byId.get(r.variantOf) ?? r : r);
  const picked = c.racquets.filter((r) => {
    if (!older && isOlderGeneration(c, familyOf_(r))) return false;
    if (age === 'junior') return isJunior(r);
    if (r.variantOf) return false;
    return age === 'all' || !isJunior(r);
  });
  const groups = new Map<string, Racquet[]>();
  for (const r of picked) groups.set(r.brand, [...(groups.get(r.brand) ?? []), r]);
  const name = (r: Racquet) => (age === 'junior' ? r.model : wallName(r));
  return [...groups.keys()].sort(byText).map((brand) => ({
    brand,
    racquets: groups.get(brand)!.sort((a, b) => byText(name(a), name(b)) || b.year - a.year),
  }));
}

/** How many frame families `older` would add for this size. */
export function olderCount(c: Catalog, age: Age): number {
  const count = (older: boolean) => wallGroups(c, age, older).reduce((n, g) => n + g.racquets.length, 0);
  return count(true) - count(false);
}

// ---------- the shop floor: brands, then lines, then sizes ----------

export function brandSlug(brand: string): string {
  return brand.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** "#/b/<brand>" opens a brand's floor. */
export function brandRoute(brand: string): string {
  return `#/b/${brandSlug(brand)}`;
}

/** The brand a "#/b/<slug>" hash names, if any. */
export function parseBrandRoute(hash: string, brands: readonly string[]): string | null {
  const m = /^#\/b\/([a-z0-9-]+)\/?$/.exec(hash);
  return m ? brands.find((b) => brandSlug(b) === m[1]) ?? null : null;
}

/** A family and its variants as full entries, base first, limited to one size. */
export function membersOf(c: Catalog, family: Racquet, age: Age): Racquet[] {
  const byId = new Map(c.racquets.map((r) => [r.id, r]));
  const ids = family.variants?.length ? family.variants.map((v) => v.id) : [family.id];
  return ids.map((id) => byId.get(id)).filter((r): r is Racquet => !!r && (age === 'all' || isJunior(r) === (age === 'junior')));
}

/** A lineage's display name: its line, plus what sets it apart ("Pure Aero Rafa", "O3 Phantom"). */
export function lineageName(family: Racquet): string {
  const own = brandSlug(`${family.brand} ${family.line}`);
  if (family.lineage === own) return family.line;
  const tail = family.lineage.replace(`${brandSlug(family.brand)}-`, '');
  const lineSlug = brandSlug(family.line);
  const rest = tail.startsWith(lineSlug) ? tail.slice(lineSlug.length).replace(/^-/, '') : tail;
  const word = (w: string) => (w.length <= 2 || /\d/.test(w) || w === 'vs' ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1));
  const words = rest.split('-').filter(Boolean).map(word).join(' ');
  return tail.startsWith(lineSlug) ? `${family.line} ${words}`.trim() : words;
}

export interface Shelf {
  lineage: string;
  name: string;
  /** Generations with something in the chosen size, newest first. */
  generations: Racquet[];
}

/** A brand's floor: one shelf per line (lineage), the lines with most sizes first. */
export function shelvesOf(c: Catalog, brand: string, age: Age): Shelf[] {
  const families = c.racquets.filter((r) => r.brand === brand && !r.variantOf);
  const lineages = new Map<string, Racquet[]>();
  for (const f of families) if (membersOf(c, f, age).length) lineages.set(f.lineage, [...(lineages.get(f.lineage) ?? []), f]);
  return [...lineages.entries()]
    .map(([lineage, gens]) => {
      const generations = gens.sort((a, b) => b.year - a.year || byText(b.generation, a.generation));
      return { lineage, name: lineageName(generations[0]), generations };
    })
    // The big lines lead (most sizes on the newest shelf), newest first among equals.
    .sort((a, b) =>
      membersOf(c, b.generations[0], age).length - membersOf(c, a.generations[0], age).length ||
      b.generations[0].year - a.generations[0].year ||
      byText(a.name, b.name));
}

export interface Aisle {
  brand: string;
  /** Up to five current flagships to fan out, the biggest line in the middle. */
  fan: Racquet[];
  lines: number;
  racquets: number;
  colourways: number;
  noModel: number;
}

/** The home floor: one aisle per brand with a modelled racquet in this size, alphabetical. */
export function aislesOf(c: Catalog, age: Age): Aisle[] {
  const brands = [...new Set(c.racquets.map((r) => r.brand))].sort(byText);
  const out: Aisle[] = [];
  for (const brand of brands) {
    const shelves = shelvesOf(c, brand, age);
    if (!shelves.length) continue;
    const current = shelves.map((s) => s.generations[0]);
    const flagships = current
      .map((f) => membersOf(c, f, age)[0])
      .slice(0, 5);
    // Middle-out: biggest line at the centre, the next ones alternating either side.
    const fan: Racquet[] = [];
    flagships.forEach((r, i) => (i % 2 ? fan.unshift(r) : fan.push(r)));
    const all = shelves.flatMap((s) => s.generations.flatMap((g) => membersOf(c, g, age)));
    out.push({
      brand,
      fan,
      lines: shelves.length,
      racquets: all.length,
      colourways: all.reduce((n, r) => n + (r.colourways?.length ?? 0), 0),
      noModel: (c.placeholders ?? []).filter((p) => p.brand === brand && matchesAge(p.category, age)).length,
    });
  }
  return out;
}
