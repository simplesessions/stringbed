// Pure logic for finding by how things play and what they are: the filters, their addresses and the
// matching. No DOM.
import type { Catalog } from '../../src/catalog';
import type { StringMaterial, StringSpec } from '../../src/string-spec';
import { formatPattern, generationsOf, isJunior, membersOf, wallName, type Age, type Racquet } from './catalog-view';
import type { Level, Profile, RatingKey as PlayKey } from './profiles';
import type { RatingKey as StringKey } from './string-view';

/** "Rated 4 or more, out of 5" is what picking a trait asks for. */
export const STRONG = 4;

type Choices<K extends string> = ReadonlyArray<{ id: K; label: string }>;
export type Head = 'small' | 'mid' | 'large';
export type Weight = 'light' | 'medium' | 'heavy';
export type Gauge = 'thin' | 'middle' | 'thick';
export type Shape = 'round' | 'shaped';

/** In the order players ask for them. */
export const RACQUET_TRAITS: Choices<PlayKey> = [
  { id: 'spin', label: 'Spin' },
  { id: 'control', label: 'Control' },
  { id: 'power', label: 'Power' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'stability', label: 'Stability' },
  { id: 'maneuverability', label: 'Manoeuvrability' },
  { id: 'feel', label: 'Feel' },
];
export const STRING_TRAITS: Choices<StringKey> = (['spin', 'control', 'power', 'comfort', 'feel', 'durability'] satisfies StringKey[])
  .map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));
export const LEVEL_CHOICES: Choices<Level> = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];
export const HEAD_CHOICES: Choices<Head> = [
  { id: 'small', label: '98 in² or less' },
  { id: 'mid', label: '99 to 104 in²' },
  { id: 'large', label: '105 in² or more' },
];
export const WEIGHT_CHOICES: Choices<Weight> = [
  { id: 'light', label: 'Under 285 g' },
  { id: 'medium', label: '285 to 304 g' },
  { id: 'heavy', label: '305 g or more' },
];
export const GAUGE_CHOICES: Choices<Gauge> = [
  { id: 'thin', label: '1.20 mm or thinner' },
  { id: 'middle', label: '1.21 to 1.27 mm' },
  { id: 'thick', label: '1.28 mm or thicker' },
];
export const SHAPE_CHOICES: Choices<Shape> = [
  { id: 'round', label: 'Round' },
  { id: 'shaped', label: 'Shaped or twisted' },
];

const headOf = (sqIn: number): Head => (sqIn <= 98 ? 'small' : sqIn < 105 ? 'mid' : 'large');
const weightOf = (g: number): Weight => (g < 285 ? 'light' : g < 305 ? 'medium' : 'heavy');
const gaugeOf = (mm: number): Gauge => (mm <= 1.2 ? 'thin' : mm < 1.28 ? 'middle' : 'thick');

export interface RacquetFind {
  play: PlayKey[];
  level: Level | null;
  head: Head | null;
  weight: Weight | null;
  /** "16x19" */
  pattern: string | null;
}
export interface StringFind {
  play: StringKey[];
  gauge: Gauge | null;
  shape: Shape | null;
  value: boolean;
}
export const NO_RACQUET_FIND: RacquetFind = { play: [], level: null, head: null, weight: null, pattern: null };
export const NO_STRING_FIND: StringFind = { play: [], gauge: null, shape: null, value: false };

export const isEmptyFind = (f: RacquetFind | StringFind): boolean => Object.values(f).every((v) => !v || (Array.isArray(v) && v.length === 0));

const one = <K extends string>(choices: Choices<K>, v: string | null): K | null => choices.find((c) => c.id === v)?.id ?? null;
const many = <K extends string>(choices: Choices<K>, v: string | null): K[] =>
  [...new Set((v ?? '').split(','))].flatMap((x) => one(choices, x) ?? []);
const query = (pairs: Array<[string, string | null]>) => pairs.flatMap(([k, v]) => (v ? [`${k}=${v}`] : [])).join('&');

export function parseRacquetFind(q: string): RacquetFind {
  const p = new URLSearchParams(q);
  const pattern = p.get('pattern');
  return {
    play: many(RACQUET_TRAITS, p.get('play')),
    level: one(LEVEL_CHOICES, p.get('level')),
    head: one(HEAD_CHOICES, p.get('head')),
    weight: one(WEIGHT_CHOICES, p.get('weight')),
    pattern: pattern && /^\d{2}x\d{2}$/.test(pattern) ? pattern : null,
  };
}
export const formatRacquetFind = (f: RacquetFind): string =>
  query([['play', f.play.join(',')], ['level', f.level], ['head', f.head], ['weight', f.weight], ['pattern', f.pattern]]);

export function parseStringFind(q: string): StringFind {
  const p = new URLSearchParams(q);
  return {
    play: many(STRING_TRAITS, p.get('play')),
    gauge: one(GAUGE_CHOICES, p.get('gauge')),
    shape: one(SHAPE_CHOICES, p.get('shape')),
    value: p.get('value') === '1',
  };
}
export const formatStringFind = (f: StringFind): string =>
  query([['play', f.play.join(',')], ['gauge', f.gauge], ['shape', f.shape], ['value', f.value ? '1' : null]]);

/** The string patterns in the catalog, the commonest first. */
export function patternChoices(c: Catalog): Choices<string> {
  const n = new Map<string, { label: string; n: number }>();
  for (const r of c.racquets) {
    const id = r.specs.stringPattern.join('x');
    n.set(id, { label: formatPattern(r.specs.stringPattern), n: (n.get(id)?.n ?? 0) + 1 });
  }
  return [...n.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([id, x]) => ({ id, label: x.label }));
}

export interface RacquetHit {
  /** The newest generation of its line with a size that matches. */
  family: Racquet;
  /** The sizes of it that match, the family's own order. */
  matching: Racquet[];
  /** How many sizes it has at this age. */
  sizes: number;
  /** Null when unrated, and for juniors: a profile describes the adult frame. */
  ratings: Profile['ratings'] | null;
}
export interface RacquetFound {
  hits: RacquetHit[];
  /** Lines that fit the specs but have no ratings, left out by a play or level filter. */
  unrated: number;
  /** Lines left out by a weight filter only because no source states a weight. */
  noWeight: number;
}

/** One hit per line. With traits picked, the highest rated come first; otherwise the newest. */
export function findRacquets(c: Catalog, profiles: Map<string, Profile>, f: RacquetFind, age: Age): RacquetFound {
  const rated = f.play.length > 0 || f.level !== null;
  const fits = (r: Racquet, weight: boolean) =>
    (f.head === null || headOf(r.specs.headSizeSqIn) === f.head)
    && (f.pattern === null || r.specs.stringPattern.join('x') === f.pattern)
    && (!weight || f.weight === null || (r.specs.unstrungWeightG !== undefined && weightOf(r.specs.unstrungWeightG) === f.weight));
  const out: RacquetFound = { hits: [], unrated: 0, noWeight: 0 };
  const lines = [...new Set(c.racquets.filter((r) => !r.variantOf).map((r) => r.lineage))];
  for (const lineage of lines) {
    const generations = generationsOf(c, c.racquets.find((r) => !r.variantOf && r.lineage === lineage)!);
    let hit: RacquetHit | null = null;
    // What the line has any word on, in any generation: a gap counts only when none of them says.
    let judged = false;
    let weighed = false;
    let gap = false;
    for (const family of generations) {
      const members = membersOf(c, family, age);
      const sized = members.filter((r) => fits(r, false));
      weighed ||= sized.some((r) => r.specs.unstrungWeightG !== undefined);
      const matching = sized.filter((r) => fits(r, true));
      if (!matching.length) {
        gap ||= f.weight !== null && sized.length > 0;
        continue;
      }
      const profile = profiles.get(family.id);
      const adults = matching.filter((r) => !isJunior(r));
      if (rated) {
        if (!adults.length) continue;
        if (!profile) {
          gap = true;
          continue;
        }
        judged = true;
        if (!f.play.every((k) => profile.ratings[k] >= STRONG) || (f.level && !profile.playerLevel.includes(f.level))) continue;
      }
      hit = { family, matching: rated ? adults : matching, sizes: members.length, ratings: adults.length ? (profile?.ratings ?? null) : null };
      break;
    }
    if (hit) out.hits.push(hit);
    else if (gap && f.weight !== null && !weighed) out.noWeight++;
    else if (gap && rated && !judged && (f.weight === null || weighed)) out.unrated++;
  }
  const score = (h: RacquetHit) => f.play.reduce((n, k) => n + (h.ratings?.[k] ?? 0), 0);
  out.hits.sort((a, b) => score(b) - score(a) || b.family.year - a.family.year
    || a.family.brand.localeCompare(b.family.brand, 'en') || wallName(a.family).localeCompare(wallName(b.family), 'en'));
  return out;
}

export interface StringFound {
  hits: StringSpec[];
  /** Strings left out by a shape filter only because no source states a shape. */
  noShape: number;
}

/** With traits picked, the highest rated come first; otherwise by brand and name. */
export function findStrings(all: StringSpec[], f: StringFind, material: StringMaterial | null): StringFound {
  const rest = all.filter((s) =>
    (material === null || s.material === material)
    && f.play.every((k) => s.ratings[k] >= STRONG)
    && (f.gauge === null || s.gaugesMm.some((g) => gaugeOf(g) === f.gauge))
    && (!f.value || s.bestFor.includes('value')));
  const hits = rest.filter((s) => f.shape === null || (s.shape && (s.shape.sides >= 3 || s.shape.twisted ? 'shaped' : 'round') === f.shape));
  const score = (s: StringSpec) => f.play.reduce((n, k) => n + s.ratings[k], 0);
  hits.sort((a, b) => score(b) - score(a) || a.brand.localeCompare(b.brand, 'en') || a.name.localeCompare(b.name, 'en'));
  return { hits, noShape: f.shape === null ? 0 : rest.filter((s) => !s.shape).length };
}

/** "spin and control" */
const words = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** How the matches are ordered, and what picking a trait asked of them. */
export function orderNote<K extends string>(traits: Choices<K>, play: K[], otherwise: string): string {
  if (!play.length) return otherwise;
  const named = words(play.map((k) => traits.find((t) => t.id === k)!.label.toLowerCase()));
  return `Rated ${STRONG} or more out of 5 for ${named}, highest first.`;
}
