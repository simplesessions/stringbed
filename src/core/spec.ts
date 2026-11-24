import { z } from 'zod';

export type HeadShape = 'oval' | 'isometric' | 'teardrop';
export type BeamProfile = 'box' | 'ellipse' | 'aero' | 'tapered-box';
export type Finish = 'matte' | 'satin' | 'gloss';
export type Feature = 'o-ports' | 'aero-fins';
export type HexColor = string; // "#rrggbb"
export type BeamFace = 'outer' | 'inner' | 'front' | 'back';
export type RacquetSide = 'left' | 'right';

export interface Variant extends Partial<Pick<RacquetSpec, 'model' | 'generation' | 'year' | 'specs' | 'geometry' | 'paint' | 'parts' | 'sources' | 'verified' | 'colourway' | 'colourways'>> {
  id: string;
  label: string;
}

export interface Colourway {
  id: string; // kebab-case, e.g. "espresso-brown"
  name: string; // "Espresso Brown"
  year?: number;
  paint: RacquetSpec['paint'];
  parts?: { [K in Exclude<keyof RacquetSpec['parts'], 'dampener'>]?: Partial<RacquetSpec['parts'][K]> };
  sources: string[];
}

export interface TrimPart {
  color: HexColor;
  /** "frame": the part carries the frame's paint zones as vertex colours (its own colour is unused). */
  paint?: 'frame';
  /**
   * Grommets only: the strip covers this fraction of the beam's thickness, centred on the outer
   * edge, like the channel on a real frame; the painted frame shows either side. Default: the
   * whole outer half of the section.
   */
  channel?: number;
}

export interface RacquetSpec {
  id: string; // kebab-case, equals the file name, e.g. "babolat-pure-aero-100"
  brand: string;
  line: string;
  model: string; // display name, "Pure Aero 100"
  generation: string; // "2026", "v10", "V2"
  year: number;
  specs: {
    headSizeSqIn: number; // 85..115
    lengthIn: number; // 26..29
    stringPattern: [number, number]; // [mains, crosses], each 12..22
    beamMm: [number, number, number]; // [tip, mid, shaft], each 14..32
    unstrungWeightG?: number;
  };
  geometry: {
    head: { shape: HeadShape; aspect: number }; // aspect = inner length / inner width, 1.2..1.45
    beam: { profile: BeamProfile };
    throat: { style: 'open-v' | 'open-u'; bridge: 'curved' | 'flat' };
    features: Feature[];
    /**
     * Handle cross-section. elongationMm = pallet width in the string plane (bevel 1 to 5) minus
     * its depth along the face normal (bevel 3 to 7). Default 0, a regular octagon. Every handle
     * has the same girth: grip size is the buyer's choice, not part of the frame.
     */
    handle?: { elongationMm: number }; // 0..8
  };
  paint: {
    base: HexColor;
    finish: Finish;
    // from/to are frame coordinate u, 0..1. `faces` limits a zone to some faces of the beam:
    // outer (the edge away from the strings), inner (the string side), front, back. Default: all.
    // `side` limits it to one half of the racquet, as seen from the front (left is -X). Default: both.
    // `bridge: false` leaves the bridge out of a zone that runs across the throat junction. Default: in.
    zones: Array<{ from: number; to: number; color: HexColor; blend?: number; faces?: BeamFace[]; side?: RacquetSide; bridge?: false }>;
    pattern?: { type: 'camo'; color: HexColor; scale: number; seed: number };
  };
  parts: {
    grip: { color: HexColor };
    collar: { color: HexColor };
    buttCap: { color: HexColor };
    strings: { color: HexColor; gaugeMm: number }; // gauge 1.0..1.4
    grommets: TrimPart;
    bumper: TrimPart;
    dampener: null | { color: HexColor };
  };
  sources: string[]; // URLs
  verified: boolean;
  /** Name of the colourway the spec itself describes, e.g. "Blast Blue". */
  colourway?: string;
  /**
   * Every generation of one line shares a lineage, e.g. "babolat-pure-aero". Default: brand and
   * line, kebab-cased; set it when two lines share a `line` value (Pure Aero vs Pure Aero Rafa).
   */
  lineage?: string;
  /** Short name of this size or version within its frame family, e.g. "MP", "100", "Pro 98". */
  variantLabel?: string;
  /**
   * Other sizes or versions of the same frame (same line and generation): each lists only the
   * top-level fields that differ, which replace the base's. `loadAllSpecs` expands them into
   * full specs, so every variant is built and published under its own id.
   */
  variants?: Variant[];
  /** Set by `loadAllSpecs` on an expanded variant: the id of the family's base spec. Not in files. */
  variantOf?: string;
  /**
   * Other official colourways of the same frame. Each replaces the paint and overrides any part
   * colours it lists; geometry is shared. Built as its own file: `<id>--<colourway id>.glb`.
   */
  colourways?: Colourway[];
}

const hex = z.string().regex(/^#[0-9a-f]{6}$/, 'expected a #rrggbb colour');
const color = z.object({ color: hex }).strict();
const trimPart = z.object({ color: hex, paint: z.literal('frame').optional(), channel: z.number().min(0.2).max(1).optional() }).strict();
const patternCount = z.number().int().min(12).max(22);
const beam = z.number().min(14).max(32);
const unit = z.number().min(0).max(1);

const zone = z
  .object({
    from: unit,
    to: unit,
    color: hex,
    blend: z.number().min(0).max(0.5).optional(),
    faces: z.array(z.enum(['outer', 'inner', 'front', 'back'])).min(1).optional(),
    side: z.enum(['left', 'right']).optional(),
    bridge: z.literal(false).optional(),
  })
  .strict()
  .refine((z) => z.from < z.to, { message: 'from must be less than to', path: ['to'] });

const paintSchema = z
  .object({
    base: hex,
    finish: z.enum(['matte', 'satin', 'gloss']),
    zones: z.array(zone),
    pattern: z
      .object({ type: z.literal('camo'), color: hex, scale: z.number().positive(), seed: z.number().int() })
      .strict()
      .optional(),
  })
  .strict();

const baseSpecSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected kebab-case'),
    brand: z.string().min(1),
    line: z.string().min(1),
    model: z.string().min(1),
    generation: z.string().min(1),
    year: z.number().int(),
    specs: z
      .object({
        headSizeSqIn: z.number().min(55).max(120),
        lengthIn: z.number().min(16).max(29),
        stringPattern: z.tuple([patternCount, patternCount]),
        beamMm: z.tuple([beam, beam, beam]),
        unstrungWeightG: z.number().positive().optional(),
      })
      .strict(),
    geometry: z
      .object({
        head: z
          .object({
            shape: z.enum(['oval', 'isometric', 'teardrop']),
            aspect: z.number().min(1.2).max(1.45),
          })
          .strict(),
        beam: z.object({ profile: z.enum(['box', 'ellipse', 'aero', 'tapered-box']) }).strict(),
        throat: z
          .object({ style: z.enum(['open-v', 'open-u']), bridge: z.enum(['curved', 'flat']) })
          .strict(),
        features: z.array(z.enum(['o-ports', 'aero-fins'])),
        handle: z.object({ elongationMm: z.number().min(0).max(8) }).strict().optional(),
      })
      .strict(),
    paint: paintSchema,
    parts: z
      .object({
        grip: color,
        collar: color,
        buttCap: color,
        strings: z.object({ color: hex, gaugeMm: z.number().min(1.0).max(1.4) }).strict(),
        grommets: trimPart,
        bumper: trimPart,
        dampener: color.nullable(),
      })
      .strict(),
    sources: z.array(z.string().url()),
    verified: z.boolean(),
    colourway: z.string().min(1).optional(),
    colourways: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected kebab-case'),
            name: z.string().min(1),
            year: z.number().int().optional(),
            paint: paintSchema,
            parts: z
              .object({
                grip: color.partial(),
                collar: color.partial(),
                buttCap: color.partial(),
                strings: z.object({ color: hex, gaugeMm: z.number().min(1.0).max(1.4) }).strict().partial(),
                grommets: trimPart.partial(),
                bumper: trimPart.partial(),
              })
              .strict()
              .partial()
              .optional(),
            sources: z.array(z.string().url()).min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const variantSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected kebab-case'),
    label: z.string().min(1),
  })
  .extend(
    baseSpecSchema
      .pick({ model: true, generation: true, year: true, specs: true, geometry: true, paint: true, parts: true, sources: true, verified: true, colourway: true, colourways: true })
      .partial().shape,
  )
  .strict();

export const racquetSpecSchema = baseSpecSchema
  .extend({
    lineage: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected kebab-case').optional(),
    variantLabel: z.string().min(1).optional(),
    variants: z.array(variantSchema).optional(),
  })
  .strict() satisfies z.ZodType<Omit<RacquetSpec, 'variantOf'>, unknown>;

/** The lineage a spec belongs to: its own, or brand and line kebab-cased. */
export function lineageOf(spec: Pick<RacquetSpec, 'lineage' | 'brand' | 'line'>): string {
  return spec.lineage ?? `${spec.brand} ${spec.line}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** A family's variant as a full spec: the base with the variant's fields in place of its own. */
export function withVariant(base: RacquetSpec, v: Variant): RacquetSpec {
  const { id, label, ...fields } = v;
  return { ...base, colourway: undefined, colourways: undefined, ...fields, id, variantLabel: label, variants: undefined, variantOf: base.id };
}

/** The spec as it would read for one of its colourways: that paint, those part colours. */
export function withColourway(spec: RacquetSpec, cw: Colourway): RacquetSpec {
  const parts = { ...spec.parts };
  for (const [k, v] of Object.entries(cw.parts ?? {})) {
    (parts as Record<string, unknown>)[k] = { ...(spec.parts as Record<string, object>)[k], ...v };
  }
  return { ...spec, paint: cw.paint, parts, colourway: cw.name, colourways: undefined };
}

export function parseSpec(data: unknown, fileName: string): RacquetSpec {
  const result = racquetSpecSchema.safeParse(data);
  if (result.success) return result.data;
  const lines = result.error.issues.map(
    (i) => `${fileName}: ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
  );
  throw new Error(lines.join('\n'));
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Node only. Reads `<dir>/<brand>/*.json`, sorted by brand then model then id. */
export function loadAllSpecs(dir = 'racquets'): RacquetSpec[] {
  // Resolved at call time, not imported, so the library entry stays bundle-safe for browsers.
  const { readdirSync, readFileSync } = process.getBuiltinModule('node:fs');
  const { basename, join, resolve } = process.getBuiltinModule('node:path');
  const root = resolve(process.cwd(), dir);
  const specs: RacquetSpec[] = [];
  const brandDirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(cmp);
  for (const brandDir of brandDirs) {
    const files = readdirSync(join(root, brandDir))
      .filter((f) => f.endsWith('.json'))
      .sort(cmp);
    for (const file of files) {
      const label = `${brandDir}/${file}`;
      let data: unknown;
      try {
        data = JSON.parse(readFileSync(join(root, brandDir, file), 'utf8'));
      } catch (e) {
        throw new Error(`${label}: invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      const spec = parseSpec(data, label);
      if (spec.id !== basename(file, '.json')) {
        throw new Error(`${label}: id: "${spec.id}" does not match file name`);
      }
      specs.push(spec, ...(spec.variants ?? []).map((v) => withVariant(spec, v)));
    }
  }
  return specs.sort((a, b) => cmp(a.brand, b.brand) || cmp(a.model, b.model) || cmp(a.id, b.id));
}
