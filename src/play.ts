import type { Readout } from './mass';
import type { StringSpec } from './string-spec';

// How a string setup plays on a racquet: our estimate from the ratings and the settings, not a measurement.
// Coefficients are the "What it does: the estimate" table in docs/superpowers/specs/2026-11-24-strings-and-build-design.md.

export const PLAY_KEYS = ['power', 'spin', 'control', 'comfort', 'stability', 'maneuverability', 'feel', 'durability'] as const;
export type PlayKey = (typeof PLAY_KEYS)[number];
type Shifts = Partial<Record<PlayKey, number>>;

export interface PlayInput {
  racquet: { name: string; ratings: Partial<Record<PlayKey, number>> | null; pattern: [number, number]; junior: boolean };
  /** string null: not known (stock), so not rated. It shifts nothing itself, and no sentence speaks of it. */
  mains: { string: StringSpec | null; gaugeMm: number; tensionLb: number };
  crosses: PlayInput['mains'];
  addedPlay: Readout['addedPlay'];
}
export interface PlayRow { key: PlayKey; base: number | null; value: number | null; shift: number; reasons: Array<{ text: string; shift: number }> }

export const SHIFT = {
  /** "Mains count 0.65, crosses 0.35." */
  mains: 0.65,
  crosses: 0.35,
  /** Row 1: per point of string rating above 3. */
  rating: { above: 3, per: { power: 0.35, spin: 0.35, control: 0.35, comfort: 0.35, feel: 0.35 } as Shifts },
  /** Row 2: per 5 lb above 52, at most 3 steps either way. */
  tension: { reference: 52, step: 5, limit: 3, per: { power: -0.25, control: 0.2, comfort: -0.25, spin: -0.05 } as Shifts },
  /** Row 3: per 0.05 mm thinner than 1.25 (thicker goes the other way). */
  gauge: { reference: 1.25, step: 0.05, per: { spin: 0.08, feel: 0.08, power: 0.05, control: -0.04, durability: -0.3 } as Shifts },
  /** Row 4: per 10 kg·cm² of swingweight added. */
  swingweight: { step: 10, per: { stability: 0.3, maneuverability: -0.35, power: 0.1 } as Shifts },
  /** Row 5: per 0.5 kg·cm² of twist added. */
  twist: { step: 0.5, per: { stability: 0.1 } as Shifts },
};

/** A reason shows from this size; the verdict names a rise or fall from this size. */
const CUT = 0.1;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
type Side = PlayInput['mains'];
const sides = (i: PlayInput): Array<[Side, number]> => [[i.mains, SHIFT.mains], [i.crosses, SHIFT.crosses]];
const blend = (i: PlayInput, f: (s: Side) => number) => sides(i).reduce((sum, [s, w]) => sum + w * f(s), 0);
const stringName = (s: StringSpec) => `${s.brand} ${s.name}`;
const nameOf = (s: Side) => (s.string ? stringName(s.string) : 'stock strings');
const same = (i: PlayInput) => i.mains.string?.id === i.crosses.string?.id;
const lbs = (n: number) => `${Math.round(n * 10) / 10}`;

/** Each cause as its own step count; a cause's shift on a key is steps × the table's coefficient. */
function causes(i: PlayInput) {
  const { tension, gauge, swingweight, twist } = SHIFT;
  const ratingSteps = (key: keyof typeof SHIFT.rating.per) => blend(i, (s) => (s.string ? (s.string.ratings as Record<string, number>)[key] - SHIFT.rating.above : 0));
  const tensionSteps = blend(i, (s) => clamp((s.tensionLb - tension.reference) / tension.step, -tension.limit, tension.limit));
  const gaugeSteps = blend(i, (s) => (gauge.reference - s.gaugeMm) / gauge.step);
  const t = i.mains.tensionLb === i.crosses.tensionLb ? `${lbs(i.mains.tensionLb)} lb` : `${lbs(i.mains.tensionLb)} and ${lbs(i.crosses.tensionLb)} lb`;
  const g = i.mains.gaugeMm === i.crosses.gaugeMm ? `${i.mains.gaugeMm.toFixed(2)} mm` : `${i.mains.gaugeMm.toFixed(2)} and ${i.crosses.gaugeMm.toFixed(2)} mm`;
  return [
    { text: same(i) ? nameOf(i.mains) : `${nameOf(i.mains)} with ${nameOf(i.crosses)}`, per: SHIFT.rating.per, steps: (k: PlayKey) => ratingSteps(k as keyof typeof SHIFT.rating.per) },
    { text: `${t} tension`, per: tension.per, steps: () => tensionSteps },
    { text: `${g} gauge`, per: gauge.per, steps: () => gaugeSteps },
    { text: 'Weight added', per: swingweight.per, steps: () => i.addedPlay.swingweight / swingweight.step },
    { text: 'Twist added', per: twist.per, steps: () => i.addedPlay.twist / twist.step },
  ];
}

export function estimate(input: PlayInput): PlayRow[] {
  const all = causes(input);
  return PLAY_KEYS.map((key) => {
    // Rounded when built, so the cut, the sum and what is shown all agree (0.35 × 1.0000000000000009 must not miss a 0.35).
    const list = all.flatMap((c) => (c.per[key] ? [{ text: c.text, shift: round3(c.per[key]! * c.steps(key)) }] : []));
    const shift = round3(list.reduce((sum, r) => sum + r.shift, 0));
    // Durability starts from the strings' own rating; the racquet has none, and strings nobody knows have none either.
    const known = input.mains.string && input.crosses.string;
    const base = key === 'durability' ? (known ? blend(input, (s) => s.string!.ratings.durability) : null) : input.racquet.ratings ? (input.racquet.ratings[key] ?? null) : null;
    const reasons = list.filter((r) => Math.abs(r.shift) >= CUT).sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift)).slice(0, 3);
    return { key, base, value: base === null ? null : clamp(base + shift, 1, 5), shift, reasons };
  });
}

const LABEL: Record<PlayKey, string> = { power: 'power', spin: 'spin', control: 'control', comfort: 'comfort', stability: 'stability', maneuverability: 'manoeuvrability', feel: 'feel', durability: 'durability' };

/** How far a rating really moves: one clamped at 1 or 5 goes less far than its shift, or nowhere. */
export const moveOf = (r: PlayRow): number => round3(r.value === null || r.base === null ? r.shift : r.value - r.base);

export function verdict(input: PlayInput): string[] {
  const { racquet: { name, pattern, junior }, mains, crosses, addedPlay } = input;
  const strings = [mains.string, crosses.string].flatMap((s) => s ?? []);
  const mats = strings.map((s) => s.material);
  const poly = (s: Side) => s.string?.material === 'polyester';
  const rows = estimate(input);
  const spin = moveOf(rows.find((r) => r.key === 'spin')!);
  const spinner = strings.find((s) => s.ratings.spin >= 4);
  const gut = strings.find((s) => s.material === 'natural-gut');
  const polyString = strings.find((s) => s.material === 'polyester');
  const moved = rows.map((r) => ({ key: r.key, by: moveOf(r) }));
  const rise = moved.reduce((a, r) => (r.by > a.by ? r : a), { by: 0, key: 'power' as PlayKey });
  const fall = moved.reduce((a, r) => (r.by < a.by ? r : a), { by: 0, key: 'power' as PlayKey });
  const [m, c] = pattern;
  const out: string[] = [];
  const add = (applies: unknown, text: () => string) => { if (applies && out.length < 3) out.push(text()); };
  const sw = (n: number) => lbs(Math.abs(n));

  add(junior && mats.includes('polyester'), () => 'Polyester, even in part, is a hard ride for a young arm; a multifilament would be kinder.');
  add(poly(mains) && poly(crosses) && Math.min(mains.tensionLb, crosses.tensionLb) > 56, () => `Polyester in the mains and crosses at this tension will feel stiff and unforgiving on the ${name}; try a few pounds lower.`);
  add(spin >= 0.4 && m + c <= 34, () => `The open ${m}×${c} pattern lets these strings grab the ball, so the ${name} gets noticeably more spin than it does as it comes.`);
  add(m >= 18 && c >= 20 && spinner, () => `The dense ${m}×${c} pattern holds back what ${stringName(spinner!)} could give in spin.`);
  add(gut && polyString, () => `In this hybrid the ${stringName(gut!)} brings the power and comfort, while the ${stringName(polyString!)} brings the control and durability.`);
  add(addedPlay.swingweight >= 8, () => `The added weight lifts swingweight by ${sw(addedPlay.swingweight)} kg·cm²: steadier on contact, slower to swing.`);
  add(addedPlay.swingweight <= -3, () => `Swingweight is down ${sw(addedPlay.swingweight)} kg·cm²: quicker through the swing, with less plough-through on contact.`);
  add(rise.by >= CUT, () => `The ${name} gains most in ${LABEL[rise.key]}, by about ${rise.by.toFixed(1)} of a point.`);
  add(fall.by <= -CUT, () => `It gives up most in ${LABEL[fall.key]}, by about ${Math.abs(fall.by).toFixed(1)} of a point.`);
  return out.length ? out : [`Close to how the ${name} plays as it comes.`];
}
