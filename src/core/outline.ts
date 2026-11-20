import type { HeadShape } from './spec';
import { sqInToSqM } from './units';

export type Vec2 = { x: number; y: number };

interface ShapeParams {
  nTop: number; // superellipse exponent of the top half
  nBottom: number; // exponent of the bottom half
  taper: number; // width bias along y: width *= 1 + taper * (y / halfLength); > 0 favours the top
}

const SHAPES: Record<HeadShape, ShapeParams> = {
  oval: { nTop: 2.2, nBottom: 2.2, taper: 0.04 },
  isometric: { nTop: 3.0, nBottom: 2.3, taper: 0.03 },
  teardrop: { nTop: 2.2, nBottom: 2.1, taper: 0.14 },
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Raw (unscaled) right half of the curve, tip to bottom, sampled finely by angle. */
function rawRightHalf(p: ShapeParams, samples: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= samples; i++) {
    const theta = (Math.PI * i) / samples; // 0 at the tip, PI at the bottom
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    // The exponent blends smoothly with c = cos(theta) (+1 top, -1 bottom): no kink at the equator.
    const n = p.nBottom + (p.nTop - p.nBottom) * smoothstep((c + 1) / 2);
    const e = 2 / n;
    const y = Math.sign(c) * Math.abs(c) ** e;
    const x = s ** e * (1 + p.taper * y);
    pts.push({ x, y });
  }
  return pts;
}

/** Resample a polyline into `count + 1` points evenly spaced by arc length (endpoints kept). */
function resample(pts: Vec2[], count: number): Vec2[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const out: Vec2[] = [];
  let j = 1;
  for (let k = 0; k <= count; k++) {
    const target = (total * k) / count;
    while (j < pts.length - 1 && cum[j] < target) j++;
    const span = cum[j] - cum[j - 1] || 1;
    const t = (target - cum[j - 1]) / span;
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t });
  }
  return out;
}

/**
 * Closed loop of the INNER edge of the hoop (the string-bed boundary), in metres, centred on the
 * origin (bounding box centre). Point 0 is the tip (0, +halfLength). Order is clockwise when viewed
 * from +Z with Y up: from the tip the loop heads toward +x, down the right side, across the bottom
 * and back up the -x side. Symmetric about x = 0. Points are evenly spaced by arc length.
 * Scaled so length/width = aspect and polygon area = headSizeSqIn.
 *
 * Shape: a superellipse |x|^n + |y|^n = 1 whose exponent n varies smoothly between a top and a
 * bottom value, with a linear width bias along y (egg or teardrop). `n` must be even and >= 8.
 */
export function headOutline(shape: HeadShape, headSizeSqIn: number, aspect: number, n: number): Vec2[] {
  if (n < 8 || n % 2 !== 0) throw new Error(`headOutline: n must be even and >= 8, got ${n}`);
  const half = n / 2;
  // Fix the aspect ratio and centre on the bounding box BEFORE resampling, so the arc-length
  // spacing is measured on the final proportions.
  const dense = rawRightHalf(SHAPES[shape], 4096);
  const width = 2 * Math.max(...dense.map((p) => p.x));
  const height = dense[0].y - dense[dense.length - 1].y;
  const sx = height / aspect / width;
  const midY = (dense[0].y + dense[dense.length - 1].y) / 2;
  const shaped = resample(
    dense.map((p) => ({ x: p.x * sx, y: p.y - midY })),
    half,
  );
  shaped[0].x = 0;
  shaped[half].x = 0;

  const full: Vec2[] = shaped.slice();
  for (let i = half - 1; i >= 1; i--) full.push({ x: -shaped[i].x, y: shaped[i].y });
  const k = Math.sqrt(sqInToSqM(headSizeSqIn) / polygonArea(full));
  return full.map((p) => ({ x: p.x * k, y: p.y * k }));
}

/** Absolute polygon area in square metres (shoelace). */
export function polygonArea(loop: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Half-width of the loop at height y: max |x| over the polygon's crossings of the line Y = y. */
export function outlineHalfWidthAt(loop: Vec2[], y: number): number {
  let best = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    if ((a.y - y) * (b.y - y) > 0) continue; // edge entirely on one side
    if (a.y === b.y) {
      best = Math.max(best, Math.abs(a.x), Math.abs(b.x));
      continue;
    }
    const t = (y - a.y) / (b.y - a.y);
    best = Math.max(best, Math.abs(a.x + (b.x - a.x) * t));
  }
  return best;
}
