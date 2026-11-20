import type { PartName } from './core/build';
import type { HexColor, RacquetSpec } from './core/spec';
import type { Placeholder } from './placeholders';

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
  }>;
  /** Researched racquets with no model yet (placeholders/), without their research notes. */
  placeholders: Array<Omit<Placeholder, 'status' | 'notes' | 'verified'>>;
}
