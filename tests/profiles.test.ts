import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const root = join(import.meta.dir, '..');
const specIds = new Set(
  readdirSync(join(root, 'racquets'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(root, 'racquets', f), 'utf8')).id as string),
);

const tags = ['spin', 'power', 'control', 'comfort', 'stability', 'maneuverability', 'feel', 'touch', 'forgiveness', 'serves', 'volleys', 'groundstrokes', 'all-court', 'baseline', 'net-play'] as const;
const rating = z.number().int().min(1).max(5);
const profile = z
  .object({
    id: z.string(),
    summary: z.string().refine((s) => s.split(/\s+/).length >= 45 && s.split(/\s+/).length <= 90, 'summary must be 45-90 words'),
    bestFor: z.array(z.enum(tags)).min(1).max(4),
    playerLevel: z.array(z.enum(['beginner', 'intermediate', 'advanced'])).min(1),
    playStyle: z.string().min(1),
    feel: z.string().min(1),
    ratings: z.object({ power: rating, spin: rating, control: rating, comfort: rating, stability: rating, maneuverability: rating, feel: rating }).strict(),
    compared: z.array(z.string()).max(3).default([]),
    variantNotes: z.record(z.string(), z.string()).optional(),
    released: z.string().optional(),
    confidence: z.enum(['high', 'medium', 'low']),
    sources: z.array(z.string().url()).min(1),
    researchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const files = readdirSync(join(root, 'profiles')).filter((f) => f.endsWith('.json'));

describe('profiles', () => {
  const seen = new Set<string>();
  for (const f of files) {
    const list = z.array(profile).parse(JSON.parse(readFileSync(join(root, 'profiles', f), 'utf8')));
    for (const p of list) {
      test(`${f}: ${p.id}`, () => {
        expect(specIds.has(p.id)).toBe(true);
        expect(seen.has(p.id)).toBe(false);
        seen.add(p.id);
        for (const c of p.compared) expect(specIds.has(c)).toBe(true);
      });
    }
  }
});
