import type { PartName } from './core/build';
import type { HexColor, RacquetSpec } from './core/spec';
import type { SpoolPartName } from './core/spool';
import type { Placeholder } from './placeholders';
import type { StringSpec } from './string-spec';

export interface Catalog {
  version: 1;
  styles: Array<{ id: string; kind: '3d' | '2d'; label: string; extension: string }>;
  racquets: Array<{
    id: string;
    brand: string;
    line: string;
    model: string;
    generation: string;
    year: number;
    specs: RacquetSpec['specs'];
    swatch: HexColor; // paint.base, for placeholders
    parts: PartName[];
    /** Keyed by style id; path is relative to assets/, e.g. "realistic/babolat-pure-aero-100.glb". */
    assets: Record<string, { path: string; bytes: number; triangles: number }>;
    /** Shared by every generation of one line, e.g. "babolat-pure-aero". */
    lineage: string;
    /** Short name within its frame family ("MP", "98"), when the frame comes in variants. */
    variantLabel?: string;
    /** On a variant: the id of its family's main entry (the one the wall shows). */
    variantOf?: string;
    /** On a family's main entry: every variant in display order, itself first. */
    variants?: Array<{ id: string; label: string }>;
    /** Name of the default colourway (the one in `swatch` and `assets`), when the spec names it. */
    colourway?: string;
    /** Other official colourways, each with its own files ("realistic/<id>--<colourway>.glb"). */
    colourways?: Array<{
      id: string;
      name: string;
      year?: number;
      swatch: HexColor;
      assets: Record<string, { path: string; bytes: number; triangles: number }>;
    }>;
  }>;
  /**
   * Every downloadable file, one row each: the quickest way to import a racquet. Filter by brand,
   * line, lineage, year, variant or colourway, then load `path` (relative to the catalog's folder).
   */
  files: Array<{
    /** Racquet id (the variant's own id). */
    id: string;
    brand: string;
    line: string;
    lineage: string;
    model: string;
    generation: string;
    year: number;
    variant: string | null;
    /** Colourway id, null for the racquet's default colourway. */
    colourway: string | null;
    colourwayName: string | null;
    style: string;
    path: string;
    bytes: number;
  }>;
  /** Researched racquets with no model yet (placeholders/), without their research notes. */
  placeholders: Array<Omit<Placeholder, 'status' | 'notes' | 'verified'>>;
}

/** assets/strings.json: the strings plus the one spool model the gallery tints to each string's colour. */
export interface StringCatalog {
  version: 1;
  spool: { path: string; bytes: number; triangles: number; parts: SpoolPartName[] };
  strings: StringSpec[];
}
