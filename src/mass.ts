import { gripTopY } from './core/layout';
import type { RacquetSpec } from './core/spec';
import { inToM } from './core/units';
import type { Bed, Beds } from './restring';
import type { StringMaterial } from './string-spec';
import type { PlacedTape } from './tape';

type Specs = RacquetSpec['specs'];
/** What a string weighs by. */
export interface Strung { material: StringMaterial; gaugeMm: number }

/** A mass on the racquet, metres from the butt's centre. One spread evenly along a line has its middle here, and the line's length in run. */
export interface PointMass { g: number; x: number; y: number; label: string; runX?: number; runY?: number }

/** kg/m³. */
export const DENSITY: Record<StringMaterial, number> = {
  polyester: 1380, // PET: https://en.wikipedia.org/wiki/Polyethylene_terephthalate
  multifilament: 1140, // nylon 6: https://en.wikipedia.org/wiki/Nylon_6
  'synthetic-gut': 1140, // nylon 6, as above
  'natural-gut': 1300, // unsourced estimate
};
/** String past each line's ends, through and round the frame, metres: an unsourced estimate. */
export const WRAP_M = 0.034;
/** "One inch of this lead tape weighs 0.25 grams": Tourna ¼ in reel, https://www.tennis-warehouse.com/Tourna_Lead_Tape_Reel_1_4_inch_x_36_yards/descpageUNIQUE-LEADSMALL.html */
export const TAPE_G_PER_INCH = 0.25;
/** Wilson Pro Overgrip: https://tenniscompanion.org/wilson-pro-overgrips/ */
export const OVERGRIP_G = 4.9;
/** Wilson Pro Feel: https://tenniscompanion.org/wilson-pro-feel/ */
export const DAMPENER_G = 2.9;

/** Swingweight is measured about an axis 4 in from the butt. */
const SWING_AXIS_M = inToM(4);
const POINT_MM = 3.175; // 1/8 in
const NEWTONS_PER_LB = 4.4482216;

/** The bed published strung figures are taken to have. Sources rarely say, so this is an assumption. */
export const PUBLISHED_BED: Strung = { material: 'synthetic-gut', gaugeMm: 1.3 };
/** The bed the play estimate measures from. */
export const REFERENCE_BED: Strung = { material: 'polyester', gaugeMm: 1.25 };

/** kg per metre. */
const linear = ({ material, gaugeMm }: Strung): number => (Math.PI / 4) * (gaugeMm / 1000) ** 2 * DENSITY[material];

/** Every string, mains first: its mass spread along the line the model has for it. */
export function stringMasses(beds: Beds, mains: Strung, crosses: Strung): PointMass[] {
  const weigh = (bed: Bed, s: Strung, across: boolean): PointMass[] => bed.lines.map(({ at, from, to }) => {
    const run = to - from;
    const middle = (from + to) / 2;
    const g = linear(s) * (run + WRAP_M) * 1000;
    return across ? { g, x: middle, y: at, label: 'cross string', runX: run } : { g, x: at, y: middle, label: 'main string', runY: run };
  });
  return [...weigh(beds.mains, mains, false), ...weigh(beds.crosses, crosses, true)];
}

/** Each piece at its middle. It weighs what was asked for: the laid path runs a little long or short over a ledge. */
export function tapeMasses(placed: PlacedTape[]): PointMass[] {
  return placed.map(({ piece, centroid }) => ({ g: (piece.lengthMm / 25.4) * piece.layers * TAPE_G_PER_INCH, x: centroid.x, y: centroid.y, label: 'lead tape' }));
}

/** An overgrip, wound evenly from the butt to the top of the grip. */
export function overgripMass(lengthIn: number): PointMass {
  const run = gripTopY(lengthIn);
  return { g: OVERGRIP_G, x: 0, y: run / 2, label: 'overgrip', runY: run };
}

const centreMain = (beds: Beds) => beds.mains.lines.reduce((a, b) => (Math.abs(b.at) < Math.abs(a.at) ? b : a));

/**
 * A dampener between the two centre mains, seated on the lowest cross: published models leave under 7 mm
 * between that and the bridge, where the frame would hide it. With an odd count "the centre two" are the middle string and
 * the one to its right, as buildDampener has it. It is drawn here too.
 */
export function dampenerMass(beds: Beds): PointMass {
  const mains = beds.mains.lines; // left to right
  const b = (mains.length >> 1) + (mains.length % 2);
  const [left, right] = [mains[b - 1], mains[b]];
  const lowest = Math.min(...beds.crosses.lines.map((l) => l.at));
  return { g: DAMPENER_G, x: (left.at + right.at) / 2, y: lowest, label: 'dampener' };
}

interface Sum { g: number; moment: number; swingweight: number; twist: number }

/** g, g·mm about the butt, kg·cm² about the swing axis, kg·cm² about the long axis. */
function sum(parts: PointMass[]): Sum {
  const out: Sum = { g: 0, moment: 0, swingweight: 0, twist: 0 };
  for (const { g, x, y, runX = 0, runY = 0 } of parts) {
    out.g += g;
    out.moment += g * y * 1000;
    out.swingweight += 10 * g * ((y - SWING_AXIS_M) ** 2 + runY ** 2 / 12); // 1 g m² is 10 kg cm²
    out.twist += 10 * g * (x ** 2 + runX ** 2 / 12);
  }
  return out;
}

const bedOf = (beds: Beds, s: Strung): Sum => sum(stringMasses(beds, s, s));

/** A bare racquet's weight and balance, both from one kind of source. */
export interface Baseline { g: number; balanceMm: number; from: 'yours' | 'published' | 'derived' }

/** The best pair there is, unstrung: yours, the maker's, or strung figures less a plain bed. Half a pair counts as none. */
export function baseline(specs: Specs, beds: Beds, yours: { g?: number; balanceMm?: number } = {}): Baseline | null {
  const pair = (from: Baseline['from'], g?: number, balanceMm?: number): Baseline | null => (g === undefined || balanceMm === undefined ? null : { g, balanceMm, from });
  const strung = pair('derived', specs.strungWeightG, specs.strungBalanceMm);
  const derived = (): Baseline | null => {
    if (!strung) return null;
    const bed = bedOf(beds, PUBLISHED_BED);
    const g = strung.g - bed.g;
    return { g, balanceMm: (strung.g * strung.balanceMm - bed.moment) / g, from: 'derived' };
  };
  return pair('yours', yours.g, yours.balanceMm) ?? pair('published', specs.unstrungWeightG, specs.balanceMm) ?? derived();
}

export interface Readout {
  weightG: number | null;
  balanceMm: number | null;
  pointsHeadLight: number | null; // negative: head heavy
  about: boolean; // something here is derived from strung figures less a plain bed: the balance, or a weight with no balance
  weightAbout: boolean; // the weight itself is. A published weight beside a derived balance is not
  swingweight: number | null; // only when a swingweight is published, and always about
  /** Everything put on, strings included. kg·cm². */
  added: { g: number; swingweight: number; twist: number };
  /** The same against a 1.25 mm polyester bed and nothing else. */
  addedPlay: { swingweight: number; twist: number };
}

/**
 * The racquet with `parts` on it: its strings and whatever else. Stock strings must be passed in parts
 * too: without any, every figure is an unstrung racquet's and addedPlay is the whole reference bed short.
 */
export function readout(specs: Specs, beds: Beds, base: Baseline | null, parts: PointMass[]): Readout {
  const { g, moment, swingweight, twist } = sum(parts);
  const reference = bedOf(beds, REFERENCE_BED);
  const plain = bedOf(beds, PUBLISHED_BED);
  // A derived balance brings its own weight, but one that was published, or typed in, is the one to show.
  const given = base && base.from !== 'derived' ? base.g : specs.unstrungWeightG;
  const bare = given ?? base?.g ?? (specs.strungWeightG === undefined ? null : specs.strungWeightG - plain.g);
  const weightAbout = given === undefined && bare !== null;
  const balanceMm = base && (base.g * base.balanceMm + moment) / (base.g + g);
  return {
    weightG: bare === null ? null : bare + g,
    balanceMm,
    pointsHeadLight: balanceMm === null ? null : ((specs.lengthIn * 25.4) / 2 - balanceMm) / POINT_MM,
    about: base?.from === 'derived' || weightAbout,
    weightAbout,
    swingweight: specs.swingweight === undefined ? null : specs.swingweight - plain.swingweight + swingweight,
    added: { g, swingweight, twist },
    addedPlay: { swingweight: swingweight - reference.swingweight, twist: twist - reference.twist },
  };
}

/** The note a plucked centre main sounds. */
export function pitchHz(beds: Beds, mains: Strung, tensionLb: number): number {
  const { from, to } = centreMain(beds);
  return Math.sqrt((tensionLb * NEWTONS_PER_LB) / linear(mains)) / (2 * (to - from));
}
