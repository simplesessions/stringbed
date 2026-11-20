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
