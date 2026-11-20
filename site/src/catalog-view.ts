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

/** Brands alphabetical; models alphabetical within a brand. */
export function groupByBrand(c: Catalog): BrandGroup[] {
  const groups = new Map<string, Racquet[]>();
  for (const r of c.racquets) {
    const list = groups.get(r.brand) ?? [];
    list.push(r);
    groups.set(r.brand, list);
  }
  return [...groups.keys()].sort(byText).map((brand) => ({
    brand,
    racquets: [...groups.get(brand)!].sort((a, b) => byText(a.model, b.model)),
  }));
}

export function filterByBrand(groups: BrandGroup[], brand: string | null): BrandGroup[] {
  return brand === null ? groups : groups.filter((g) => g.brand === brand);
}

/** Join Vite's BASE_URL with a catalog path, e.g. ('/stringbed/', 'realistic/x.glb'). */
export function assetUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

const ROUTE = /^#\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

export function parseRoute(hash: string): { racquetId: string | null } {
  const m = ROUTE.exec(hash);
  return { racquetId: m ? m[1] : null };
}

export function routeFor(racquetId: string | null): string {
  return racquetId === null ? '#/' : `#/${racquetId}`;
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

/** Which racquets to show by size. Every modelled racquet is an adult frame. */
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
