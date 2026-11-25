// Pure view logic for the string browser and the shared search. No DOM.
import type { HexColor } from '../../src/core/spec';
import type { Catalog } from '../../src/catalog';
import type { StringMaterial, StringSpec } from '../../src/string-spec';
import { brandNamed, fold, searchRacquets, searchScore, type SearchHit } from './catalog-view';
import type { StringsRoute } from './routes';

export const MATERIAL_LABEL: Record<StringMaterial, string> = {
  polyester: 'Polyester',
  multifilament: 'Multifilament',
  'synthetic-gut': 'Synthetic gut',
  'natural-gut': 'Natural gut',
};

export const MATERIALS = Object.keys(MATERIAL_LABEL) as StringMaterial[];

/** The material filter as it was left; anything else is no filter. */
export const savedMaterial = (stored: string | null): StringMaterial | null => MATERIALS.find((m) => m === stored) ?? null;

export type RatingKey = keyof StringSpec['ratings'];
/** The Record makes a missing rating a type error; importing the list itself would bring zod with it. */
export const RATING_LABEL: Record<RatingKey, string> = {
  power: 'Power',
  spin: 'Spin',
  control: 'Control',
  comfort: 'Comfort',
  feel: 'Feel',
  durability: 'Durability',
};
export const RATING_KEYS = Object.keys(RATING_LABEL) as RatingKey[];

const byText = (a: string, b: string) => a.localeCompare(b, 'en');
const inAisle = (a: StringSpec, b: StringSpec) => byText(a.name, b.name) || byText(a.id, b.id);

export interface StringAisle {
  brand: string;
  strings: StringSpec[];
  /** Up to five strings to fan out, distinct default colours first. */
  fan: StringSpec[];
  /** Colours across the aisle's strings. */
  colours: number;
}

/** Brands alphabetical, strings by name within a brand. A material filter drops brands left empty. */
export function stringAisles(all: StringSpec[], material: StringMaterial | null): StringAisle[] {
  const brands = new Map<string, StringSpec[]>();
  for (const s of all) if (material === null || s.material === material) brands.set(s.brand, [...(brands.get(s.brand) ?? []), s]);
  return [...brands.keys()].sort(byText).map((brand) => {
    const strings = brands.get(brand)!.sort(inAisle);
    const seen = new Set<string>();
    const distinct = strings.filter((s) => !seen.has(s.colours[0].hex) && seen.add(s.colours[0].hex));
    const fan = [...distinct, ...strings.filter((s) => !distinct.includes(s))].slice(0, 5);
    return { brand, strings, fan, colours: strings.reduce((n, s) => n + s.colours.length, 0) };
  });
}

/** The strings either side of `s` in the whole aisle order (brands alphabetical), wrapping round. */
export function stringNeighbours(all: StringSpec[], s: StringSpec): { prev: StringSpec; next: StringSpec } {
  const order = stringAisles(all, null).flatMap((a) => a.strings);
  const i = Math.max(0, order.findIndex((x) => x.id === s.id));
  return { prev: order[(i - 1 + order.length) % order.length] ?? s, next: order[(i + 1) % order.length] ?? s };
}

/** The usual gauge number for a thickness, for a string nobody gave one. Makers differ by half a step. */
export const usualGauge = (mm: number): string => (mm >= 1.335 ? '15L' : mm >= 1.255 ? '16' : mm >= 1.185 ? '17' : mm >= 1.115 ? '18' : mm >= 1.065 ? '19' : '20');

/** The gauge number a string is sold under at this thickness: "16L"; "~17" when it is only the usual one. */
export const gaugeName = (s: Pick<StringSpec, 'gaugeNames'>, mm: number): string => s.gaugeNames?.[mm.toFixed(2)] ?? `~${usualGauge(mm)}`;

/** Both: "1.25 · 16L". */
export const gaugeText = (s: Pick<StringSpec, 'gaugeNames'>, mm: number): string => `${mm.toFixed(2)} · ${gaugeName(s, mm)}`;

/** Said where a ~ shows. */
export const gaugeNote = (s: StringSpec): string | null => (s.gaugesMm.some((g) => gaugeName(s, g).startsWith('~')) ? '~ is the usual number for that thickness; no page read gave this string’s own.' : null);

export function stringFacts(s: StringSpec): Array<{ label: string; value: string }> {
  return [
    { label: 'Material', value: MATERIAL_LABEL[s.material] },
    { label: 'Shape', value: s.shape?.label ?? 'Not stated' },
    { label: 'Gauges', value: `${s.gaugesMm.map((g) => `${g.toFixed(2)}\u00a0(${gaugeName(s, g)})`).join(', ')} mm` },
    { label: 'Colours', value: String(s.colours.length) },
  ];
}

/** The colour with this id; unknown or missing: the default (first). */
export function colourOf(s: StringSpec, id: string | null): StringSpec['colours'][number] {
  return s.colours.find((c) => c.id === id) ?? s.colours[0];
}

/** What a strings address shows: a string in a colour, or a floor (`brand` null: every brand's), and what to say about it. */
export type StringsPlace =
  | { string: StringSpec; colour: StringSpec['colours'][number]; notice: '' }
  | { string: null; brand: string | null; notice: string };

export function resolveStrings(r: StringsRoute, all: StringSpec[]): StringsPlace {
  if (r.kind === 'strings') return { string: null, brand: null, notice: '' };
  if (r.kind === 'string-brand') {
    const brand = brandNamed(r.slug, all.map((s) => s.brand));
    return { string: null, brand, notice: brand === null ? `There is no string brand “${r.slug}”. Here are the brands.` : '' };
  }
  const string = all.find((s) => s.id === r.id);
  return string
    ? { string, colour: colourOf(string, r.colour), notice: '' }
    : { string: null, brand: null, notice: `There is no string with the id “${r.id}”. Here are the brands.` };
}

/** The live region's word on a floor: "Showing all 12 strings." */
export function shownStrings(all: StringSpec[], material: StringMaterial | null, brand: string | null): string {
  const n = stringAisles(all, material).filter((a) => brand === null || a.brand === brand).reduce((sum, a) => sum + a.strings.length, 0);
  const many = n === 0 ? 'no' : brand === null && n > 1 ? `all ${n}` : String(n);
  return `Showing ${[many, material && MATERIAL_LABEL[material].toLowerCase(), brand].filter(Boolean).join(' ')} ${n === 1 ? 'string' : 'strings'}.`;
}

/** Said by the swatches when the colours are an estimate. */
export const colourNote = (s: StringSpec): string | null => (s.verified ? null : 'Colours approximate: not checked against a photo.');

/** The gauge a string is drawn at first: the common 1.25 mm, else its thinnest. */
export const firstGauge = (s: StringSpec): number => s.gaugesMm.find((g) => g === 1.25) ?? s.gaugesMm[0];

/** The section in words: "Pentagonal, twisted along its length". Nothing its label already says is said twice. */
export function sectionNote(shape: StringSpec['shape']): string {
  if (!shape) return 'Shape not stated';
  return [
    shape.label,
    shape.twisted && !/twist/i.test(shape.label) ? 'twisted along its length' : null,
    shape.rough && !/rough|textur/i.test(shape.label) ? 'with a rough surface' : null,
  ].filter(Boolean).join(', ');
}

/** What a step is called, with the brand when that changes. */
export const stringStepName = (s: StringSpec, fromBrand: string): string => (s.brand === fromBrand ? s.name : `${s.brand} ${s.name}`);

export type Hit =
  | { kind: 'racquet'; hit: SearchHit }
  | { kind: 'string'; id: string; brand: string; name: string; meta: string; swatch: HexColor };

const STRING_RESERVE = 8;
const DEFAULT_LIMIT = 40;

/**
 * Racquets and strings in one list. Same scoring as searchRacquets (prefix on the model or name
 * first). Strings are guaranteed a share of the places so racquets cannot crowd them out.
 */
export function searchAll(c: Catalog, strings: StringSpec[] | null, query: string, limit = DEFAULT_LIMIT): Hit[] {
  const racquets = searchRacquets(c, query, Infinity);
  const words = fold(query).split(' ').filter(Boolean);
  const pool = words.length === 0 || !strings?.length ? [] : strings
    .map((s) => ({ s, hay: ` ${fold(`${s.brand} ${s.name} ${MATERIAL_LABEL[s.material]} ${s.shape?.label ?? ''} ${s.colours.map((x) => x.name).join(' ')}`)} `, name: fold(s.name) }))
    .filter((x) => words.every((w) => x.hay.includes(` ${w}`)));
  if (pool.length === 0) return racquets.slice(0, limit).map((hit) => ({ kind: 'racquet', hit }));

  // Same score as searchRacquets: prefix on the model first, then racquets with a 3D model.
  const racquetScore = (h: SearchHit) => searchScore(fold(h.model).startsWith(words[0]), h.hasModel);
  const found = pool
    .map((x) => ({ ...x, score: searchScore(x.name.startsWith(words[0]), true) }))
    .sort((a, b) => a.score - b.score || byText(a.s.brand, b.s.brand) || byText(a.s.name, b.s.name));
  const merge = (rs: SearchHit[], ss: typeof found): Hit[] => {
    const out: Hit[] = [];
    let i = 0, j = 0;
    while (i < rs.length || j < ss.length) {
      // A string goes first only when it scores strictly better, so racquets keep their order and win ties.
      if (j < ss.length && (i >= rs.length || ss[j].score < racquetScore(rs[i]))) {
        const { s } = ss[j++];
        out.push({ kind: 'string', id: s.id, brand: s.brand, name: s.name, meta: [MATERIAL_LABEL[s.material], s.shape?.label].filter(Boolean).join(' · '), swatch: s.colours[0].hex });
      } else out.push({ kind: 'racquet', hit: rs[i++] });
    }
    return out;
  };

  const reserve = limit === DEFAULT_LIMIT ? STRING_RESERVE : Math.ceil(limit / 5);
  const natural = merge(racquets, found).slice(0, limit).filter((h) => h.kind === 'string').length;
  const take = Math.min(found.length, Math.max(natural, reserve), limit);
  return merge(racquets.slice(0, limit - take), found.slice(0, take));
}
