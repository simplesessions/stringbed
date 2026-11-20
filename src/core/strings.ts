import * as THREE from 'three';
import { bridgeRings, findJunction, frameContext } from './frame';
import type { Layout } from './layout';
import { outlineHalfWidthAt, type Vec2 } from './outline';
import { RawMesh } from './raw';
import type { RacquetSpec } from './spec';

/** Outermost main sits at this fraction of the widest inner width (the mains span, edge to edge). */
const MAINS_SPAN_FRACTION = 0.9;
/** > 0 packs the middle mains tighter than the outer ones (cubic spread, outer string stays put). */
const CENTRE_PACKING = 0.12;
/** Crosses start and stop this far (beyond half the gauge) from the bridge and the inner tip. */
const CROSS_END_MARGIN = 0.006;
/** Mains and crosses sit this far either side of z = 0 so their faces never coincide. */
const STRING_Z_OFFSET = 0.0003;

/**
 * Main string x positions, metres, ascending and symmetric about 0. `innerWidth` is the span from
 * the outermost main to the opposite one. Odd counts have a string at x = 0.
 */
export function mainPositions(count: number, innerWidth: number): number[] {
  const half = innerWidth / 2;
  return Array.from({ length: count }, (_, i) => {
    const s = count === 1 ? 0 : (2 * i - (count - 1)) / (count - 1); // -1..1, antisymmetric
    return half * (s + CENTRE_PACKING * (s * s * s - s));
  });
}

export interface StringBed {
  /** Highest y inside the hoop at |x| (inner outline, upper branch). */
  upperY(x: number): number;
  /** Lowest y a string may reach at |x|: the inner outline, or the bridge's upper edge if higher. */
  lowerY(x: number): number;
  /** Half-width of the inner outline at height y. */
  halfWidthAt(y: number): number;
  /** Widest inner width (full). */
  width: number;
  /** y of the inner tip. */
  innerTipY: number;
}

/** Interpolate y at x along a polyline whose x is monotone (either direction); clamps at the ends. */
function yAlong(pts: Vec2[], x: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  return Math.abs(x - first.x) < Math.abs(x - last.x) ? first.y : last.y;
}

/** The string bed: the inner outline, with the bridge's upper edge as the floor. */
export function stringBed(spec: RacquetSpec, layout: Layout): StringBed {
  const ctx = frameContext(spec, layout);
  const { inner } = ctx;
  let widest = 0;
  for (let i = 1; i < inner.length; i++) if (inner[i].x > inner[widest].x) widest = i;
  const upper = inner.slice(0, widest + 1);
  const lower = inner.slice(widest);
  const full: Vec2[] = [...inner, ...inner.slice(1, -1).reverse().map((p) => ({ x: -p.x, y: p.y }))];

  // Upper edge of the bridge: each ring's centre pulled back inward by half its radial. Ascending x.
  const bridge = bridgeRings(ctx, findJunction(ctx))
    .filter((r) => r.c.x >= 0)
    .map((r) => ({ x: r.c.x + (r.t.y * r.radial) / 2, y: r.c.y - (r.t.x * r.radial) / 2 }))
    .sort((a, b) => a.x - b.x);
  const bridgeMaxX = bridge[bridge.length - 1].x;

  return {
    upperY: (x) => yAlong(upper, Math.abs(x)),
    lowerY: (x) => {
      const ax = Math.abs(x);
      const o = yAlong(lower, ax);
      return ax <= bridgeMaxX ? Math.max(o, yAlong(bridge, ax)) : o;
    },
    halfWidthAt: (y) => outlineHalfWidthAt(full, y),
    width: 2 * inner[widest].x,
    innerTipY: inner[0].y,
  };
}

/**
 * A 4-sided prism (no caps, flat shaded: 8 triangles, 16 vertices) from a to b in the XY plane,
 * `width` wide and tall, centred on z = zc.
 */
function prism(m: RawMesh, a: Vec2, b: Vec2, width: number, zc: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const dx = (b.x - a.x) / len;
  const dy = (b.y - a.y) / len;
  const px = dy; // p = d x Z, in plane
  const py = -dx;
  const h = width / 2;
  const corners: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // (p, z)
  const at = (o: Vec2, k: number) => m.vertex(o.x + px * h * corners[k][0], o.y + py * h * corners[k][0], zc + h * corners[k][1]);
  for (let k = 0; k < 4; k++) {
    const a0 = at(a, k);
    const a1 = at(a, (k + 1) % 4);
    const b0 = at(b, k);
    const b1 = at(b, (k + 1) % 4);
    m.tri(a0, b1, a1);
    m.tri(a0, b0, b1);
  }
}

/** Main strings: vertical, from the bridge's upper edge to the inner outline over the top. */
export function buildMains(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const bed = stringBed(spec, layout);
  const g = spec.parts.strings.gaugeMm / 1000;
  const m = new RawMesh();
  for (const x of mainPositions(spec.specs.stringPattern[0], bed.width * MAINS_SPAN_FRACTION)) {
    // Clip against both edges of the string so no corner pokes outside the bed.
    const lo = Math.max(bed.lowerY(x - g / 2), bed.lowerY(x + g / 2));
    const hi = Math.min(bed.upperY(x - g / 2), bed.upperY(x + g / 2));
    prism(m, { x, y: lo }, { x, y: hi }, g, STRING_Z_OFFSET);
  }
  return m.build();
}

/**
 * How far out (|x|) a string whose lower edge is at y can run: out to `limit`, but stopping where
 * the bridge's upper edge rises above it. Marches out from the centre, then bisects the last step.
 */
function reach(bed: StringBed, y: number, limit: number): number {
  const STEP = 0.0005;
  let x = 0;
  while (x < limit && bed.lowerY(x + STEP) <= y) x += STEP;
  if (x + STEP >= limit && bed.lowerY(limit) <= y) return limit;
  let lo = x;
  let hi = Math.min(limit, x + STEP);
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (bed.lowerY(mid) <= y) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Cross strings: horizontal, from just above the bridge to just below the tip, clipped to the outline. */
export function buildCrosses(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const bed = stringBed(spec, layout);
  const g = spec.parts.strings.gaugeMm / 1000;
  const n = spec.specs.stringPattern[1];
  const y0 = bed.lowerY(0) + CROSS_END_MARGIN + g / 2;
  const y1 = bed.innerTipY - CROSS_END_MARGIN - g / 2;
  const m = new RawMesh();
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * i) / (n - 1);
    const hw = Math.min(bed.halfWidthAt(y - g / 2), bed.halfWidthAt(y + g / 2));
    const half = reach(bed, y - g / 2, hw);
    prism(m, { x: -half, y }, { x: half, y }, g, -STRING_Z_OFFSET);
  }
  return m.build();
}
