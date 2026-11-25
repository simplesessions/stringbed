import type { HexColor } from '../../src/core/spec';
import type { StringSpec } from '../../src/string-spec';
import type { TapePiece, TapeZone } from '../../src/tape';

// The build page's only state, and its text form: the query part of #/build/<racquet>?… (see the design doc, "The address").

export interface StringChoice { id: string; colour: string; gaugeMm: number }
export interface Build {
  mains: StringChoice | null; crosses: StringChoice | null; // mains null: stock strings; crosses null: same as mains
  tensionLb: number; crossTensionLb: number | null; // 30-75 in halves; null: same as the mains
  tape: TapePiece[]; // at most 24
  overgrip: string | null; dampener: string | null; // ids from COLOURS
  yours: { g?: number; balanceMm?: number };
}

export const COLOURS: Array<{ id: string; name: string; hex: HexColor }> = [
  { id: 'white', name: 'White', hex: '#f2f2f0' }, { id: 'black', name: 'Black', hex: '#1c1c1e' },
  { id: 'red', name: 'Red', hex: '#c8281e' }, { id: 'blue', name: 'Blue', hex: '#1f55b8' },
  { id: 'yellow', name: 'Yellow', hex: '#e8c81a' }, { id: 'green', name: 'Green', hex: '#2e8f3e' },
  { id: 'pink', name: 'Pink', hex: '#e86a9c' }, { id: 'orange', name: 'Orange', hex: '#ec7a1c' },
];

const DEFAULT_TENSION = 52;
const DEFAULT_GAUGE = 1.25;
const MAX_TAPE = 24;
const TENSION = [30, 75], LENGTH = [10, 300], LAYERS = [1, 4], WEIGHT = [150, 420], BALANCE = [200, 450], SIDE_AT = [0, 700], GAUGE = [1, 1.45];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PIECE = /^([hlr])(\d{1,4})(m?)\.(\d{1,4})\.(\d{1,2})$/;

export function emptyBuild(): Build {
  return { mains: null, crosses: null, tensionLb: DEFAULT_TENSION, crossTensionLb: null, tape: [], overgrip: null, dampener: null, yours: {} };
}

const clamp = (x: number, [lo, hi]: number[]) => Math.min(hi, Math.max(lo, x));

/** The gauge (ascending) nearest `want`; the thinner on a tie. */
const nearest = (gauges: number[], want: number) => gauges.reduce((best, g) => (Math.abs(g - want) < Math.abs(best - want) - 1e-9 ? g : best), gauges[0]);

/** The string's colour (default: its first) at the gauge nearest 1.25 mm, the thinner on a tie. */
export function chooseString(s: StringSpec, colour?: string): StringChoice {
  const c = s.colours.find((x) => x.id === colour) ?? s.colours[0];
  return { id: s.id, colour: c.id, gaugeMm: nearest(s.gaugesMm, DEFAULT_GAUGE) };
}

const choiceText = (c: StringChoice) => `${c.id}.${c.colour}.${Math.round(c.gaugeMm * 100)}`;
const pieceText = (p: TapePiece) => `${p.zone}${p.at}${p.mirrored ? 'm' : ''}.${p.lengthMm}.${p.layers}`;

export function formatBuild(b: Build): string {
  const out: string[] = [];
  if (b.mains) out.push(`s=${choiceText(b.mains)}${b.crosses ? '~' + choiceText(b.crosses) : ''}`);
  if (b.tensionLb !== DEFAULT_TENSION || b.crossTensionLb !== null) out.push(`t=${b.tensionLb}${b.crossTensionLb !== null ? '~' + b.crossTensionLb : ''}`);
  if (b.tape.length) out.push(`l=${b.tape.map(pieceText).join('~')}`);
  if (b.overgrip) out.push(`g=${b.overgrip}`);
  if (b.dampener) out.push(`d=${b.dampener}`);
  if (b.yours.g !== undefined) out.push(`w=${b.yours.g}`);
  if (b.yours.balanceMm !== undefined) out.push(`b=${b.yours.balanceMm}`);
  return out.length ? ['v=1', ...out].join('&') : '';
}

/** Whole numbers only: null for anything else, so "12abc" and "NaN" are unreadable rather than half-read. */
const decimal = (t: string) => (/^\d+(\.\d+)?$/.test(t) ? Number(t) : null);

function parseChoice(text: string, strings: StringSpec[] | null): StringChoice | null {
  const [id, colour, gauge, ...rest] = text.split('.');
  if (rest.length || !id || !KEBAB.test(id)) return null;
  if (!/^\d{1,4}$/.test(gauge ?? '')) return null; // no gauge to read: dropped, checked or not
  const want = Number(gauge) / 100;
  if (!strings) return colour && KEBAB.test(colour) ? { id, colour, gaugeMm: clamp(want, GAUGE) } : null; // nothing to check against: keep what is well formed
  const spec = strings.find((s) => s.id === id);
  if (!spec) return null;
  return { ...chooseString(spec, colour), gaugeMm: nearest(spec.gaugesMm, want) };
}

function parsePiece(text: string): TapePiece | null {
  const m = PIECE.exec(text);
  if (!m) return null;
  const zone = m[1] as TapeZone;
  const at = Number(m[2]);
  return { zone, at: zone === 'h' ? at % 360 : clamp(at, SIDE_AT), mirrored: m[3] === 'm', lengthMm: clamp(Number(m[4]), LENGTH), layers: clamp(Number(m[5]), LAYERS) };
}

/**
 * Reads only the grammar; `v` other than 1 is read best-effort like 1. A hoop position of 360 wraps to 0 by design;
 * weight and balance round to whole numbers. Anything else is left out and named in `dropped`. `strings` null: string choices are kept unchecked. */
export function parseBuild(query: string, strings: StringSpec[] | null): { build: Build; dropped: string[] } {
  const build = emptyBuild();
  const dropped: string[] = [];
  const params = new Map<string, string>();
  for (const pair of query.replace(/^\?/, '').split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const key = pair.slice(0, eq);
    try { params.set(key, decodeURIComponent(pair.slice(eq + 1))); } catch { dropped.push(key); }
  }
  const get = (key: string) => params.get(key) || null; // empty is as good as absent

  const s = get('s');
  if (s) {
    const [m, c, ...extra] = s.split('~');
    const label = (x: string) => `string ${x.slice(0, 40) || '(empty)'}`;
    const mains = parseChoice(m, strings);
    if (!mains) dropped.push(label(m));
    if (mains) build.mains = mains;
    if (c) {
      const crosses = mains ? parseChoice(c, strings) : null; // a cross cannot exist without a main
      if (crosses) build.crosses = crosses; else dropped.push(label(c));
    }
    if (extra.length) dropped.push('string extra');
  }

  const t = get('t');
  if (t) {
    const [m, c] = t.split('~');
    const half = (x: string) => { const n = decimal(x); return n === null ? null : clamp(Math.round(n * 2) / 2, TENSION); };
    const main = half(m);
    if (main === null) dropped.push('tension'); else build.tensionLb = main;
    if (c) {
      const cross = half(c);
      if (cross === null) dropped.push('cross tension'); else build.crossTensionLb = cross;
    }
  }

  const l = get('l');
  if (l) {
    for (const text of l.split('~')) {
      if (!text) continue;
      if (build.tape.length >= MAX_TAPE) { dropped.push('tape beyond 24'); break; }
      const piece = parsePiece(text);
      if (piece) build.tape.push(piece); else dropped.push(`tape ${text.slice(0, 12)}`);
    }
  }

  for (const [key, field, label] of [['g', 'overgrip', 'overgrip'], ['d', 'dampener', 'dampener']] as const) {
    const v = get(key);
    if (v === null) continue;
    if (COLOURS.some((c) => c.id === v)) build[field] = v; else dropped.push(label);
  }

  const w = get('w'), b = get('b');
  if (w) { const n = decimal(w); if (n === null) dropped.push('weight'); else build.yours.g = clamp(Math.round(n), WEIGHT); }
  if (b) { const n = decimal(b); if (n === null) dropped.push('balance'); else build.yours.balanceMm = clamp(Math.round(n), BALANCE); }
  return { build, dropped };
}
