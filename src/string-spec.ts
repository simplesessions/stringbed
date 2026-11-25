import { z } from 'zod';
import type { Finish, HexColor } from './core/spec';

// strings/<brand>/<id>.json: one record per string. Editorial ratings and summary; see the strings design doc.

export type StringMaterial = 'polyester' | 'multifilament' | 'synthetic-gut' | 'natural-gut';
export const STRING_RATINGS = ['power', 'spin', 'control', 'comfort', 'feel', 'durability'] as const;
export const STRING_TAGS = ['spin', 'power', 'control', 'comfort', 'durability', 'feel', 'value'] as const;

export interface StringSpec {
  id: string; // kebab-case, equals the file name, starts with the brand's folder name
  brand: string;
  name: string; // without the brand: "ALU Power"
  material: StringMaterial;
  shape: { sides: number; label: string; twisted?: true; rough?: true } | null; // sides 0 round, else 3..12; null: no source says
  gaugesMm: number[]; // ascending, unique, each 1.0..1.45, at least one
  gaugeNames?: Record<string, string>; // the number it is sold under, by its mm to two places: { "1.25": "16L" }; makers differ
  colours: Array<{ id: string; name: string; hex: HexColor }>; // 1-8, first is the default, ids unique
  finish: Finish;
  summary: string; // 25-60 words
  bestFor: Array<(typeof STRING_TAGS)[number]>; // 1-3
  ratings: Record<(typeof STRING_RATINGS)[number], number>; // integers 1..5, editorial
  compared: string[]; // 0-3 ids of other strings here
  confidence: 'high' | 'medium' | 'low';
  sources: string[]; // URLs, at least one
  researchedOn: string; // YYYY-MM-DD
  verified: boolean; // true once every colour was checked against a product photo
}

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const hex = z.string().regex(/^#[0-9a-f]{6}$/, 'expected a #rrggbb colour');
const rating = z.number().int().min(1).max(5);
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const schema = z
  .object({
    id: slug,
    brand: z.string().min(1),
    name: z.string().min(1),
    material: z.enum(['polyester', 'multifilament', 'synthetic-gut', 'natural-gut']),
    shape: z
      .object({
        sides: z.number().int().refine((n) => n === 0 || (n >= 3 && n <= 12), 'expected 0 (round) or 3..12'),
        label: z.string().min(1),
        twisted: z.literal(true).optional(),
        rough: z.literal(true).optional(),
      })
      .strict()
      .nullable(),
    gaugesMm: z
      .array(z.number().min(1.0).max(1.45))
      .min(1)
      .refine((g) => g.every((v, i) => i === 0 || v > g[i - 1]), 'expected ascending, unique gauges'),
    gaugeNames: z.record(z.string(), z.string().regex(/^(1[5-9]|20)L?$/, 'expected a gauge number')).optional(),
    colours: z
      .array(z.object({ id: slug, name: z.string().min(1), hex }).strict())
      .min(1)
      .max(8)
      .refine((c) => new Set(c.map((x) => x.id)).size === c.length, 'colour ids must be unique'),
    finish: z.enum(['matte', 'satin', 'gloss']),
    summary: z.string().refine((s) => wordCount(s) >= 25 && wordCount(s) <= 60, 'expected 25-60 words'),
    bestFor: z.array(z.enum(STRING_TAGS)).min(1).max(3),
    ratings: z.object({ power: rating, spin: rating, control: rating, comfort: rating, feel: rating, durability: rating }).strict(),
    compared: z.array(slug).max(3),
    confidence: z.enum(['high', 'medium', 'low']),
    sources: z.array(z.string().url()).min(1),
    researchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    verified: z.boolean(),
  })
  .strict()
  .refine((s) => Object.keys(s.gaugeNames ?? {}).every((k) => s.gaugesMm.some((g) => g.toFixed(2) === k)), { message: 'names a gauge the string does not come in', path: ['gaugeNames'] });

// Assignment, not a cast: the compiler checks the schema's output against StringSpec.
export const stringSpecSchema: z.ZodType<StringSpec> = schema;

export function parseString(data: unknown, fileName: string): StringSpec {
  const result = stringSpecSchema.safeParse(data);
  if (result.success) return result.data;
  throw new Error(result.error.issues.map((i) => `${fileName}: ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`).join('\n'));
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Node only. Reads `<dir>/<brand>/*.json`; checks each file is named by its id and filed under its brand. Sorted by brand, name, id. */
export function loadAllStrings(dir = 'strings'): StringSpec[] {
  const { readdirSync, readFileSync } = process.getBuiltinModule('node:fs');
  const { join, resolve } = process.getBuiltinModule('node:path');
  const root = resolve(process.cwd(), dir);
  const out: StringSpec[] = [];
  for (const brandDir of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(cmp)) {
    for (const file of readdirSync(join(root, brandDir)).filter((f) => f.endsWith('.json')).sort(cmp)) {
      const label = `${dir}/${brandDir}/${file}`;
      let data: unknown;
      try { data = JSON.parse(readFileSync(join(root, brandDir, file), 'utf8')); } catch (e) { throw new Error(`${label}: ${(e as Error).message}`); }
      const s = parseString(data, label);
      if (file !== `${s.id}.json`) throw new Error(`${label}: file name does not match id "${s.id}"`);
      if (brandDir !== kebab(s.brand)) throw new Error(`${label}: brand "${s.brand}" filed under ${brandDir}/`);
      if (!s.id.startsWith(`${brandDir}-`)) throw new Error(`${label}: id "${s.id}" must start with "${brandDir}-"`);
      out.push(s);
    }
  }
  return out.sort((a, b) => cmp(a.brand, b.brand) || cmp(a.name, b.name) || cmp(a.id, b.id));
}
