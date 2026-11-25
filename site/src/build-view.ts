// Pure logic of the build page: what its numbers are, what it says, where tape goes. No DOM, no three.js.
import { gripTopY } from '../../src/core/layout';
import type { HexColor } from '../../src/core/spec';
import { PUBLISHED_BED, REFERENCE_BED, TAPE_G_PER_INCH, baseline, dampenerMass, overgripMass, readout, stringMasses, tapeMasses, type PointMass, type Strung } from '../../src/mass';
import { PLAY_KEYS, estimate, moveOf, verdict, type PlayInput, type PlayKey, type PlayRow } from '../../src/play';
import type { Beds } from '../../src/restring';
import type { StringMaterial, StringSpec } from '../../src/string-spec';
import type { PlacedTape, TapePiece } from '../../src/tape';
import { COLOURS, type Build, type StringChoice } from './build-state';
import { fold, type Racquet } from './catalog-view';
import { MATERIAL_LABEL, colourOf } from './string-view';

type Specs = Racquet['specs'];
export type Place = Pick<TapePiece, 'zone' | 'at'>;

// ---------- the address ----------

export const droppedNotice = (dropped: string[]): string => (dropped.length ? `Some of this link could not be read: ${dropped.join(', ')}. The rest is here.` : '');

// ---------- strings ----------

/** Nobody says what a racquet comes strung with, so stock strings are taken as 1.25 mm polyester, the bed the estimate measures from. */
export const STOCK: Strung = REFERENCE_BED;

export interface Chosen {
  spec: StringSpec;
  choice: StringChoice;
  colour: StringSpec['colours'][number];
}

function chosen(choice: StringChoice, strings: StringSpec[]): Chosen | null {
  const spec = strings.find((s) => s.id === choice.id);
  return spec ? { spec, choice, colour: colourOf(spec, choice.colour) } : null;
}

/** What is strung. Null: stock strings, or no list to look the choice up in. */
export function chosenStrings(b: Build, strings: StringSpec[] | null): { mains: Chosen; crosses: Chosen } | null {
  const mains = b.mains && strings && chosen(b.mains, strings);
  if (!mains) return null;
  return { mains, crosses: (b.crosses && chosen(b.crosses, strings!)) ?? mains };
}
export type ChosenStrings = ReturnType<typeof chosenStrings>;

export const strungOf = (c: Chosen | undefined): Strung => (c ? { material: c.spec.material, gaugeMm: c.choice.gaugeMm } : STOCK);

/** The string list of a picker, by brand then name. The string in use is always there, first when the filter would hide it. */
export function stringList(all: StringSpec[], material: StringMaterial | null, query: string, inUse: string | null): StringSpec[] {
  const words = fold(query).split(' ').filter(Boolean);
  const list = [...all]
    .sort((a, b) => a.brand.localeCompare(b.brand, 'en') || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'))
    .filter((s) => {
      const hay = ` ${fold(`${s.brand} ${s.name} ${MATERIAL_LABEL[s.material]} ${s.shape?.label ?? ''}`)} `;
      return (material === null || s.material === material) && words.every((w) => hay.includes(` ${w}`));
    });
  const kept = inUse && !list.some((s) => s.id === inUse) ? all.find((s) => s.id === inUse) : undefined;
  return kept ? [kept, ...list] : list;
}

export const hexOf = (id: string | null): HexColor | null => COLOURS.find((c) => c.id === id)?.hex ?? null;

// ---------- the numbers ----------

/** Every change is against this racquet with stock strings and nothing else. */
export interface Figures {
  /** `added`: everything on the bare frame, strings included. */
  weight: { value: number | null; about: boolean; from: 'yours' | 'published' | 'derived' | null; added: number; change: number };
  balance: { value: number | null; about: boolean; points: number | null; change: number | null; missing: 'Not published' | 'Not given' };
  swingweight: { value: number | null; change: number };
  twist: number;
  /** Tape, grip and dampener together, and where their middle is. */
  extras: { g: number; centreMm: number } | null;
}

export function figures(specs: Specs, beds: Beds, b: Build, set: ChosenStrings, placed: PlacedTape[]): Figures {
  const stock = stringMasses(beds, STOCK, STOCK);
  const strung = stringMasses(beds, strungOf(set?.mains), strungOf(set?.crosses));
  const extras: PointMass[] = [...tapeMasses(placed), ...(b.overgrip ? [overgripMass(specs.lengthIn)] : []), ...(b.dampener ? [dampenerMass(beds)] : [])];
  const both = b.yours.g !== undefined && b.yours.balanceMm !== undefined;
  const base = baseline(specs, beds, both ? b.yours : {});
  const now = readout(specs, beds, base, [...strung, ...extras]);
  const was = readout(specs, beds, base, stock);
  const half = b.yours.g !== undefined && !both; // your weight alone: no balance can be worked out from it
  const g = extras.reduce((sum, m) => sum + m.g, 0);
  return {
    weight: {
      value: half ? b.yours.g! + now.added.g : now.weightG,
      about: !half && now.weightAbout,
      from: b.yours.g !== undefined ? 'yours' : now.weightG === null ? null : now.weightAbout ? 'derived' : 'published',
      added: now.added.g,
      change: now.added.g - was.added.g,
    },
    balance: {
      value: half ? null : now.balanceMm,
      about: !half && now.about && now.balanceMm !== null,
      points: half ? null : now.pointsHeadLight,
      change: half || now.balanceMm === null || was.balanceMm === null ? null : now.balanceMm - was.balanceMm,
      missing: half ? 'Not given' : 'Not published',
    },
    swingweight: { value: now.swingweight, change: now.addedPlay.swingweight },
    twist: now.addedPlay.twist,
    extras: g > 0 ? { g, centreMm: (extras.reduce((sum, m) => sum + m.g * m.y, 0) / g) * 1000 } : null,
  };
}

// ---------- what is said ----------

const signed = (n: number, unit = '', none = 'no change') => {
  const t = Math.abs(n).toFixed(1);
  return t === '0.0' ? none : `${n > 0 ? '+' : '−'}${t}${unit}`;
};
const about = (yes: boolean, text: string) => (yes ? `about ${text}` : text);
const FROM = { yours: 'yours', published: 'bare', derived: 'bare, about' } as const;

export interface Cell {
  value: string;
  change: string;
  /** What the change is against, or is made of. */
  against: string;
  note: string;
}
const VS_STOCK = 'vs stock strings';
const UNIT = 'kg·cm²';

function pointsText(points: number, long: boolean): string {
  const n = Math.round(Math.abs(points));
  if (n === 0) return 'even';
  return `${n} ${long ? (n === 1 ? 'point' : 'points') : n === 1 ? 'pt' : 'pts'} ${points > 0 ? 'head light' : 'head heavy'}`;
}

export function readoutCells(f: Figures): Record<'weight' | 'balance' | 'swingweight' | 'twist', Cell> {
  const { weight: w, balance: b, swingweight: s, extras } = f;
  return {
    weight: {
      value: w.value === null ? 'Not published' : about(w.about, `${Math.round(w.value)} g`),
      note: w.value === null || !w.from ? '' : w.from === 'derived' ? `about ${Math.round(w.value - w.added)} g bare` : `${Math.round(w.value - w.added)} g ${FROM[w.from]}`,
      change: signed(w.change, ' g'),
      against: VS_STOCK,
    },
    balance: {
      value: b.value === null ? b.missing : about(b.about, `${Math.round(b.value)} mm`),
      note: b.points === null ? '' : pointsText(b.points, false),
      change: b.change !== null ? signed(b.change, ' mm') : extras ? `${signed(extras.g, ' g')} at ${Math.round(extras.centreMm)} mm` : 'no change',
      against: b.change === null && extras ? 'tape, grip and dampener' : VS_STOCK, // without a balance there is only where the weight went on
    },
    swingweight: { value: s.value === null ? 'Not published' : about(true, String(Math.round(s.value))), note: UNIT, change: signed(s.change), against: VS_STOCK },
    twist: { value: signed(f.twist, '', '0'), note: UNIT, change: '', against: VS_STOCK },
  };
}

/** The live region's word on a change. */
export function announcement({ weight: w, balance: b }: Figures): string {
  const amount = `${Math.abs(w.change).toFixed(1)} grams ${w.change < 0 ? 'off' : 'added'}`;
  const balance = b.value === null ? `alance ${b.missing.toLowerCase()}.` : `alance ${about(b.about, `${Math.round(b.value)} millimetres`)}, ${pointsText(b.points!, true)}.`;
  if (w.value === null) return `Weight not published, ${amount}. B${balance}`;
  return `Weight ${about(w.about, `${Math.round(w.value)} grams`)}, b${balance}`;
}

/** Which numbers the arithmetic starts from, in the order `baseline` takes them. */
export function provenance(s: Specs, { g, balanceMm }: Build['yours']): string {
  if (g !== undefined && balanceMm !== undefined) return `Starting from your own ${g} g and ${balanceMm} mm, unstrung.`;
  if (g !== undefined) return `Starting from your own ${g} g, unstrung. No balance given, so none is shown.`;
  if (s.unstrungWeightG && s.balanceMm) return `Starting from the published ${s.unstrungWeightG} g and ${s.balanceMm} mm, unstrung.`;
  if (s.strungWeightG && s.strungBalanceMm) {
    const from = s.unstrungWeightG ? `The weight starts from the published ${s.unstrungWeightG} g unstrung. The balance is` : 'Starting from';
    return `${from} ${s.strungWeightG} g and ${s.strungBalanceMm} mm strung, less a plain bed of ${PUBLISHED_BED.gaugeMm} mm nylon, so it is about right.`;
  }
  if (s.unstrungWeightG) return `Starting from the published ${s.unstrungWeightG} g unstrung. No balance is published for this racquet.`;
  return 'No weight or balance is published for this racquet, so only what you add can be worked out.';
}

/** Half a pair of your own measurements asks for the other half. */
export function yoursHint({ g, balanceMm }: Build['yours']): string {
  if ((g === undefined) === (balanceMm === undefined)) return '';
  return g === undefined ? 'Add the weight too: the balance is not used without it.' : 'Add the balance too.';
}

/** How the beam lies: degrees (the handle is on the left, so head light is negative), and how far along the balance is, 0 to 1. Level when nobody knows. */
export function beamPose(points: number | null, balanceMm: number | null, lengthMm: number): { tilt: number; dot: number | null } {
  return { tilt: points === null ? 0 : Math.max(-12, Math.min(12, -points * 1.5)) + 0, dot: points === null || balanceMm === null ? null : balanceMm / lengthMm };
}

export type TensionUnit = 'lb' | 'kg';
const KG = 0.45359237;
export const tensionText = (lb: number, unit: TensionUnit): string => (unit === 'lb' ? `${lb} lb` : `${(lb * KG).toFixed(1)} kg`);

/** The limits the address keeps (build-state.ts): a number outside them would come back changed. */
const MEASURES = {
  g: { min: 150, max: 420, unit: 'g', name: 'Weight' },
  balanceMm: { min: 200, max: 450, unit: 'mm', name: 'Balance' },
} as const;

/** A number someone typed. Blank is none. */
export function cleanMeasure(key: keyof typeof MEASURES, text: string): { value: number | undefined } | { error: string } {
  const { min, max, unit, name } = MEASURES[key];
  if (!text.trim()) return { value: undefined };
  const n = Math.round(Number(text.trim()));
  return n >= min && n <= max ? { value: n } : { error: `${name} must be between ${min} and ${max} ${unit}.` };
}

// ---------- tape ----------

export const MAX_TAPE = 24;
const MAX_LAYERS = 4;
/** A new piece, before anything about it is changed. */
export const NEW_PIECE = { mirrored: true, lengthMm: 80, layers: 1 } as const;

const selfMirrored = ({ zone, at }: Place) => zone === 'h' && at % 180 === 0;
const sidesOf = (p: TapePiece) => (p.mirrored && !selfMirrored(p) ? 2 : 1);
export const gramsOf = (p: TapePiece): number => (p.lengthMm / 25.4) * TAPE_G_PER_INCH * p.layers * sidesOf(p);

/** The same place on the other side. */
export const mirrored = ({ zone, at }: Place): Place => (zone === 'h' ? { zone, at: (360 - at) % 360 } : { zone: zone === 'l' ? 'r' : 'l', at });

/** Where a pointer means: the hour, when it is close to one. */
export function snapped(p: Place): Place {
  const hour = Math.round(p.at / 30) * 30;
  return p.zone === 'h' && Math.abs(p.at - hour) <= 3 ? { zone: 'h', at: hour % 360 } : p;
}

function clockText(deg: number): string {
  const minutes = (deg % 30) * 2;
  const hour = Math.floor(deg / 30) || 12;
  return minutes ? `${hour}:${String(minutes).padStart(2, '0')}` : String(hour);
}

/** "3 and 9 o’clock"; "Throat, both sides, 250 mm up". */
export function tapeName(p: TapePiece, lengthIn: number): string {
  if (p.zone !== 'h') {
    const part = p.at <= gripTopY(lengthIn) * 1000 ? 'Handle' : 'Throat';
    return `${part}, ${p.mirrored ? 'both sides' : p.zone === 'l' ? 'left side' : 'right side'}, ${p.at} mm up`;
  }
  const places = [p.at];
  if (sidesOf(p) === 2) {
    const right = Math.min(p.at, 360 - p.at); // said the way players say it: 10 and 2, but 3 and 9
    places.splice(0, 1, ...(right < 90 ? [360 - right, right] : [right, 360 - right]));
  }
  return places.map(clockText).join(' and ') + (places.every((d) => d % 30 === 0) ? ' o’clock' : '');
}

export const PRESETS = [
  { id: '12', label: '12' }, { id: '3-9', label: '3 and 9' }, { id: '10-2', label: '10 and 2' }, { id: 'throat', label: 'Throat' }, { id: 'handle', label: 'Handle' },
] as const;
export type Preset = (typeof PRESETS)[number]['id'];

export function presetPiece(preset: Preset, sideEndMm: number, lengthIn: number): TapePiece {
  const grip = gripTopY(lengthIn) * 1000;
  const place: Record<Preset, Place> = {
    '12': { zone: 'h', at: 0 },
    '3-9': { zone: 'h', at: 90 },
    '10-2': { zone: 'h', at: 60 },
    throat: { zone: 'r', at: sideEndMm - 50 },
    handle: { zone: 'r', at: Math.round(grip * 0.6) },
  };
  // The smallest juniors have a grip no longer than a piece: there it is cut to fit.
  const lengthMm = preset === 'handle' ? Math.min(NEW_PIECE.lengthMm, Math.floor(grip / 20) * 10) : NEW_PIECE.lengthMm;
  return { ...place[preset], ...NEW_PIECE, lengthMm };
}

/** The last whole mm up the arms that is not the hoop yet; `zoneAt` is tapeAt's word. */
export function sideEnd(zoneAt: (mm: number) => TapePiece['zone']): number {
  let lo = 0;
  let hi = 800;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (zoneAt(mid) === 'h') hi = mid;
    else lo = mid;
  }
  return lo;
}

const samePlace = (a: TapePiece, b: TapePiece) => {
  const is = (x: Place, y: Place) => x.zone === y.zone && x.at === y.at;
  return sidesOf(a) === sidesOf(b) && (is(a, b) || (sidesOf(a) === 2 && is(a, mirrored(b))));
};

/** Stick a piece on. Over one just like it in the same place it is another layer. */
export function addPiece(tape: TapePiece[], p: TapePiece): { tape: TapePiece[]; index: number; result: 'added' | 'layered' | 'layers' | 'full' } {
  const under = tape.findIndex((x) => samePlace(x, p) && x.lengthMm === p.lengthMm);
  if (under >= 0) {
    if (tape[under].layers >= MAX_LAYERS) return { tape, index: under, result: 'layers' };
    return { tape: tape.map((x, i) => (i === under ? { ...x, layers: x.layers + 1 } : x)), index: under, result: 'layered' };
  }
  if (tape.length >= MAX_TAPE) return { tape, index: -1, result: 'full' };
  return { tape: [...tape, p], index: tape.length, result: 'added' };
}

/** One press of an arrow key while aiming: round the hoop, down onto an arm, along it, and across to the other. Null: not a key for this. */
export function aimStep({ zone, at }: Place, key: string, fine: boolean, sideEndMm: number): Place | null {
  const step = fine ? 1 : 5;
  const x = Number(key === 'ArrowRight') - Number(key === 'ArrowLeft');
  const y = Number(key === 'ArrowUp') - Number(key === 'ArrowDown');
  if (!x && !y) return null;
  if (zone === 'h') {
    if (x) return { zone, at: (at + x * step + 360) % 360 };
    return y > 0 ? { zone, at: 0 } : { zone: at < 180 ? 'r' : 'l', at: sideEndMm };
  }
  if (x) return { zone: x > 0 ? 'r' : 'l', at };
  if (at + y * step > sideEndMm) return { zone: 'h', at: zone === 'r' ? 150 : 210 };
  return { zone, at: Math.max(0, at + y * step) };
}

interface Point { x: number; y: number; z: number }

/** The laid piece nearest a point, within `reach` metres. `side` 1 is its mirror. */
export function nearestPiece(laid: PlacedTape[][], p: Point, reach: number): { index: number; side: number } | null {
  let best: { index: number; side: number } | null = null;
  let least = reach;
  laid.forEach((sides, index) => sides.forEach(({ path }, side) => {
    for (const q of path) {
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (d <= least) [least, best] = [d, { index, side }];
    }
  }));
  return best;
}

/** Whether a point of the racquet's own plane is inside the string bed: within reach of the string next to it, both ways. */
export function onBed(beds: Beds, x: number, y: number): boolean {
  const near = (bed: Beds['mains'], at: number) => bed.lines.reduce((a, b) => (Math.abs(b.at - at) < Math.abs(a.at - at) ? b : a));
  const main = near(beds.mains, x);
  const cross = near(beds.crosses, y);
  return y >= main.from && y <= main.to && x >= cross.from && x <= cross.to;
}

// ---------- what it does ----------

/** The estimate and its sentences. With stock strings there is nothing to say about durability: it is the strings' own. */
export function playInput(racquet: PlayInput['racquet'], b: Build, set: ChosenStrings, addedPlay: PlayInput['addedPlay']): { rows: PlayRow[]; sentences: string[] } {
  const side = (c: Chosen | undefined, tensionLb: number) => ({ string: c?.spec ?? null, gaugeMm: c?.choice.gaugeMm ?? STOCK.gaugeMm, tensionLb });
  const input: PlayInput = { racquet, mains: side(set?.mains, b.tensionLb), crosses: side(set?.crosses, b.crossTensionLb ?? b.tensionLb), addedPlay };
  return { rows: estimate(input).filter((r) => set || r.key !== 'durability'), sentences: verdict(input) };
}

/** Whose ratings these are, and what is missing. `version`: the one a line's write-up rates, null for a frame that comes in one; `own`: it is this racquet. */
export function ratingsWord(r: { version: string | null; own: boolean; state: 'loading' | 'ready' | 'failed'; has: boolean; stock: boolean }): { head: string; notes: string[]; retry: boolean } {
  const failed = r.state === 'failed';
  return {
    head: r.has ? (r.version ? `Ratings for the ${r.version}` : 'Ratings') : '',
    notes: [
      ...(r.stock ? ['Stock strings: not rated.'] : []),
      ...(r.has && !r.own && r.version ? [`This version has no ratings of its own, so these are the ${r.version}’s.`] : []),
      ...(failed ? ['The ratings did not load, so this shows the change only.'] : []),
      ...(r.state === 'ready' && !r.has ? ['This racquet has no ratings here yet, so this shows the change only.'] : []),
    ],
    retry: failed,
  };
}

export const PLAY_LABEL: Record<PlayKey, string> = {
  power: 'Power', spin: 'Spin', control: 'Control', comfort: 'Comfort', stability: 'Stability', maneuverability: 'Manoeuvrability', feel: 'Feel', durability: 'Durability',
};
export const shiftText = (n: number): string => signed(n, '', '0');

export { moveOf };

/** The three biggest moves, biggest first. */
export function moved(rows: PlayRow[]): string {
  return rows
    .map((r) => ({ key: r.key, by: moveOf(r) }))
    .filter((r) => Math.abs(r.by) >= 0.1)
    .sort((a, b) => Math.abs(b.by) - Math.abs(a.by) || PLAY_KEYS.indexOf(a.key) - PLAY_KEYS.indexOf(b.key))
    .slice(0, 3)
    .map((r) => `${PLAY_LABEL[r.key]} ${shiftText(r.by)}`)
    .join(' · ');
}
