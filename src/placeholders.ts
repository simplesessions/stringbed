import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

// placeholders/ holds research-only records: racquets we know about but have not modelled.
// They go into catalog.json for the gallery's "No model yet" list; nothing is built from them.

const num = z.number().positive().nullable();
export const placeholderSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    status: z.literal('placeholder'),
    brand: z.string().min(1),
    line: z.string().min(1),
    model: z.string().min(1),
    generation: z.string().min(1).nullable(),
    releaseYear: z.number().int().min(1970).max(2100).nullable(),
    category: z.enum(['adult', 'junior']),
    onSaleIn: z.array(z.number().int()).min(1),
    specs: z
      .object({
        headSizeSqIn: num,
        lengthIn: num,
        stringPattern: z.tuple([z.number().int(), z.number().int()]).nullable(),
        beamMm: z.tuple([z.number(), z.number(), z.number()]).nullable(),
        unstrungWeightG: num,
        balanceMm: num,
      })
      .strict(),
    colourway: z.string().nullable(),
    sources: z.array(z.string().url()).min(1),
    notes: z.string().nullable(),
    researched: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    verified: z.literal(false),
  })
  .strict();

export type Placeholder = z.infer<typeof placeholderSchema>;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Node only. Reads `<dir>/<brand>/*.json`; checks each file is named by its id and filed under its brand. */
export function loadPlaceholders(dir = 'placeholders'): Placeholder[] {
  const root = resolve(process.cwd(), dir);
  const out: Placeholder[] = [];
  for (const brandDir of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(cmp)) {
    for (const file of readdirSync(join(root, brandDir)).filter((f) => f.endsWith('.json')).sort(cmp)) {
      const label = `${dir}/${brandDir}/${file}`;
      const result = placeholderSchema.safeParse(JSON.parse(readFileSync(join(root, brandDir, file), 'utf8')));
      if (!result.success) throw new Error(`${label}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      const p = result.data;
      if (file !== `${p.id}.json`) throw new Error(`${label}: file name does not match id "${p.id}"`);
      if (brandDir !== p.brand.toLowerCase()) throw new Error(`${label}: brand "${p.brand}" filed under ${brandDir}/`);
      out.push(p);
    }
  }
  return out;
}
