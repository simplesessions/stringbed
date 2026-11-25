import * as THREE from 'three';
import {
  beamRadialAt,
  beamThicknessAt,
  BOX_CORNER_SEGMENTS,
  findJunction,
  frameContext,
  paintSeams,
  ROUND_SECTION_POINTS,
  SEAM_EPS,
  U_JUNCTION,
  type FrameContext,
} from './frame';
import { hexToLinear } from './color';
import { paintColorAt } from './paint';
import type { Layout } from './layout';
import type { Vec2 } from './outline';
import { RawMesh } from './raw';
import { beamSectionLoop } from './section';
import type { RacquetSpec } from './spec';
import { mainPositions, stringBed } from './strings';

// ---------------------------------------------------------------------------------------------
// Trim parts are thin shells that wrap the outer half of the hoop section. Offsets are metres.
// In-plane protrusion past the frame's outer edge must stay <= 0.4 mm (the whole racquet's
// length is a tested contract), so the bumper tip is at most tipY + 0.0004.
// ---------------------------------------------------------------------------------------------
const BUMPER_OUT = 0.0003;
const BUMPER_FACE = 0.00015;
const GROMMET_OUT = 0.0002;
const GROMMET_FACE = 0.0001;
/** Aero fin ridge peak: barely past the bumper in-plane, proud on the faces. */
const FIN_OUT = 0.0004;
const FIN_FACE = 0.0008;

/** Bumper spans +-60 degrees about the head centre (10 to 2 o'clock). */
const BUMPER_HALF_ANGLE = Math.PI / 3;
const BUMPER_GAPS_PER_SIDE = 14;
const GROMMET_GAPS_PER_SIDE = 12;
/** Aero fins: angles from the tip on each side, and the half-width of a fin. */
const FIN_ANGLES = [(15 * Math.PI) / 180, (35 * Math.PI) / 180, (55 * Math.PI) / 180];
const FIN_HALF_WIDTH = 0.004; // metres along the rim
/**
 * O-ports: a row of flush dark oval insets down each side of the hoop, centred on 3 and 9 o'clock
 * (Prince's O3 frames carry five to eight per side). PORTS_PER_SIDE ovals, PORT_PITCH metres of
 * rim apart (centre to centre). Half-length along the hoop, half-height as a fraction of beam thickness.
 */
const PORTS_PER_SIDE = 5;
const PORT_PITCH = 0.037;
const PORT_HALF_LENGTH = 0.0125;
const PORT_HALF_HEIGHT_FRACTION = 0.76;
const PORT_SEGMENTS = 10;
/** Rings between the oval's centre and its edge. The port is a flat inset that follows the
 * shell's curvature, so two rings keep it within ~0.1 mm of the surface while staying cheap. */
const PORT_RINGS = 2;
/** The grommet strip sits this far below GROMMET_OUT so the o-port insets show above it. */
const PORT_LIFT = 0.00002;
/**
 * The o-port insets sit this far above GROMMET_OUT. A port spans most of the rim's depth, where the
 * section curves, so its chords sag up to ~0.1 mm between vertices; without the raise the strip
 * pokes through. Still inside the bumper's 0.3 mm and the 0.4 mm in-plane limit.
 */
const PORT_RAISE = 0.00012;
/** Linear-RGB scale of a port against the grommet colour. */
const PORT_DARKEN = 0.15;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface RimPoint {
  x: number; // inner outline point, world XY
  y: number;
  nx: number; // outward in-plane normal
  ny: number;
  u: number;
}

/** Inner-outline point at fractional index f of the right half; side -1 mirrors it to the left. */
function rimAt(ctx: FrameContext, f: number, side: 1 | -1, sJ: number): RimPoint {
  const i = Math.min(ctx.inner.length - 2, Math.floor(f));
  const k = f - i;
  const a = ctx.inner[i];
  const b = ctx.inner[i + 1];
  let tx = lerp(ctx.tangents[i].x, ctx.tangents[i + 1].x, k);
  let ty = lerp(ctx.tangents[i].y, ctx.tangents[i + 1].y, k);
  const l = Math.hypot(tx, ty);
  tx /= l;
  ty /= l;
  const arc = lerp(ctx.arc[i], ctx.arc[i + 1], k);
  return { x: side * lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), nx: side * -ty, ny: tx, u: 1 - ((1 - U_JUNCTION) * arc) / sJ };
}

/** Fractional index of the right-half outline point at `angle` radians clockwise from straight up. */
function indexAtAngle(ctx: FrameContext, angle: number): number {
  const cy = ctx.layout.headCenterY;
  const ang = (i: number) => Math.atan2(ctx.inner[i].x, ctx.inner[i].y - cy);
  for (let i = 0; i + 1 < ctx.inner.length; i++) {
    if (ang(i + 1) >= angle) return i + (angle - ang(i)) / (ang(i + 1) - ang(i));
  }
  return ctx.inner.length - 1;
}

/**
 * The outer half of a hoop section (radial x >= 0), inflated by (ex, ez) at its extremes. With
 * `channel` < 1 only the band |z| <= channel x t/2 is kept, cut cleanly at its edges.
 */
function outerSection(spec: RacquetSpec, u: number, ex: number, ez: number, channel = 1): { points: Vec2[]; centre: number } {
  const t = beamThicknessAt(spec, u);
  const r = beamRadialAt(spec, u);
  const loop = beamSectionLoop(spec.geometry.beam.profile, t, r, { roundPoints: ROUND_SECTION_POINTS, boxCornerSegments: BOX_CORNER_SEGMENTS });
  const n = loop.points.length;
  const inside = loop.points.map((p) => p.x >= -1e-12);
  let start = 0;
  while (!(inside[start] && !inside[(start + n - 1) % n])) start++;
  const points: Vec2[] = [];
  for (let j = start; inside[j % n] && points.length < n; j++) {
    const p = loop.points[j % n];
    points.push({ x: p.x + (ex * p.x) / (r / 2), y: p.y + (ez * p.y) / (t / 2) });
  }
  if (channel >= 1) return { points, centre: r / 2 };
  // Clip to the channel band. The outer half runs monotonically in z, so the band is one run.
  const lim = (channel * (t / 2)) + ez * channel;
  const band: Vec2[] = [];
  for (let j = 0; j < points.length; j++) {
    const a = points[j];
    if (Math.abs(a.y) <= lim) band.push(a);
    const b = points[j + 1];
    if (!b) break;
    // A flat face can cross both edges in one segment: add them in the order it meets them, or the
    // strip doubles back and faces inward.
    for (const edge of b.y > a.y ? [-lim, lim] : [lim, -lim]) {
      if ((a.y - edge) * (b.y - edge) < 0) {
        const k = (edge - a.y) / (b.y - a.y);
        band.push({ x: a.x + (b.x - a.x) * k, y: edge });
      }
    }
  }
  return { points: band, centre: r / 2 };
}

/** Sweep an open strip over the outer rim through the given points; `infl` gives (ex, ez) per point. */
function strip(m: RawMesh, spec: RacquetSpec, pts: RimPoint[], infl: [number, number][], paint?: PaintFn, channel = 1): void {
  let prev: number[] | null = null;
  pts.forEach((p, k) => {
    const { points, centre } = outerSection(spec, p.u, infl[k][0], infl[k][1], channel);
    const row = points.map((s) => m.vertex(p.x + p.nx * (centre + s.x), p.y + p.ny * (centre + s.x), s.y));
    if (paint) {
      const c = paint(p.u);
      for (let j = 0; j < row.length; j++) m.colour(c[0], c[1], c[2]);
    }
    if (prev) {
      for (let j = 0; j + 1 < row.length; j++) {
        m.tri(prev[j], prev[j + 1], row[j]);
        m.tri(prev[j + 1], row[j + 1], row[j]);
      }
    }
    prev = row;
  });
}

/** Frame-paint lookup for a trim strip whose spec says `paint: "frame"`. */
type PaintFn = (u: number) => readonly number[];

/** Fractional index of the inner outline at frame coordinate u (the inverse of rimAt's u). */
function indexAtU(tc: TrimContext, u: number): number {
  const target = ((1 - u) * tc.sJ) / (1 - U_JUNCTION);
  const arc = tc.ctx.arc;
  let lo = 0;
  let hi = arc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = arc[hi] - arc[lo];
  return span > 0 ? lo + (target - arc[lo]) / span : lo;
}

/**
 * Rings along the rim, plus a pair of rings at each paint-zone edge the path crosses. The pair
 * sits at one point with u either side of the edge, so `paint` cannot blend across it: the trim's
 * stripes break on the same hard line as the frame's.
 */
function ringsBetween(tc: TrimContext, f0: number, f1: number, gaps: number, side: 1 | -1, seams: number[] = []): RimPoint[] {
  const fs = Array.from({ length: gaps + 1 }, (_, k) => lerp(f0, f1, k / gaps));
  if (seams.length === 0) return fs.map((f) => rimAt(tc.ctx, f, side, tc.sJ));
  const uAt = (f: number) => rimAt(tc.ctx, f, side, tc.sJ).u;
  const lo = Math.min(uAt(f0), uAt(f1));
  const hi = Math.max(uAt(f0), uAt(f1));
  // A ring already on an edge would sit between the pair; the pair replaces it.
  const kept = fs.filter((f) => !seams.some((s) => Math.abs(uAt(f) - s) <= 2 * SEAM_EPS));
  const extra = seams
    .filter((s) => s > lo + 2 * SEAM_EPS && s < hi - 2 * SEAM_EPS)
    .flatMap((s) => [indexAtU(tc, s + SEAM_EPS), indexAtU(tc, s - SEAM_EPS)]);
  return [...kept, ...extra].sort((a, b) => a - b).map((f) => rimAt(tc.ctx, f, side, tc.sJ));
}

interface TrimContext {
  ctx: FrameContext;
  sJ: number;
  fB: number; // bumper end, fractional index
  fJ: number;
}

function trimContext(spec: RacquetSpec, layout: Layout): TrimContext {
  const ctx = frameContext(spec, layout);
  const fJ = findJunction(ctx);
  const i = Math.floor(fJ);
  const sJ = lerp(ctx.arc[i], ctx.arc[i + 1], fJ - i);
  return { ctx, sJ, fB: indexAtAngle(ctx, BUMPER_HALF_ANGLE), fJ };
}

/** A fin ridge across the rim at fractional index f: base, peak, base. */
function fin(m: RawMesh, spec: RacquetSpec, tc: TrimContext, f: number, side: 1 | -1, paint?: PaintFn): void {
  const half = FIN_HALF_WIDTH / (tc.ctx.arc[1] - tc.ctx.arc[0]); // outline samples are evenly spaced
  const fs = [f - half, f, f + half];
  const pts = fs.map((q) => rimAt(tc.ctx, Math.max(0, q), side, tc.sJ));
  // Keep the sweep clockwise: the left side runs up toward the tip.
  const infl: [number, number][] = [[BUMPER_OUT, BUMPER_FACE], [FIN_OUT, FIN_FACE], [BUMPER_OUT, BUMPER_FACE]];
  if (side === 1) strip(m, spec, pts, infl, paint);
  else strip(m, spec, pts.reverse(), infl, paint);
}

/** The frame's paint as a strip colour, when a trim part declares `paint: "frame"`. */
function trimPaint(spec: RacquetSpec, part: 'bumper' | 'grommets'): PaintFn | undefined {
  return spec.parts[part].paint === 'frame' ? (u: number) => paintColorAt(spec.paint, u) : undefined;
}

/** Bumper over the top (10 to 2 o'clock), plus aero fins when the spec has them. */
export function buildBumper(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const tc = trimContext(spec, layout);
  const paint = trimPaint(spec, 'bumper');
  const seams = paint ? paintSeams(spec) : [];
  const m = new RawMesh();
  const right = ringsBetween(tc, 0, tc.fB, BUMPER_GAPS_PER_SIDE, 1, seams);
  const left = ringsBetween(tc, 0, tc.fB, BUMPER_GAPS_PER_SIDE, -1, seams).reverse();
  const path = [...left, ...right.slice(1)]; // clockwise: up the left, over the tip, down the right
  strip(m, spec, path, path.map(() => [BUMPER_OUT, BUMPER_FACE]), paint);
  if (spec.geometry.features.includes('aero-fins')) {
    for (const angle of FIN_ANGLES) {
      const f = indexAtAngle(tc.ctx, angle);
      fin(m, spec, tc, f, 1, paint);
      fin(m, spec, tc, f, -1, paint);
    }
  }
  return m.build();
}

/** The shell's outer x at height z, from an outerSection polyline (z monotone). */
function xAtZ(points: Vec2[], z: number): number {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if ((a.y - z) * (b.y - z) <= 0 && a.y !== b.y) return lerp(a.x, b.x, (z - a.y) / (b.y - a.y));
  }
  return points.reduce((best, p) => Math.max(best, p.x), -Infinity);
}

/** Point on the grommet shell (right side) at fractional index f and height z. */
function shellPoint(m: RawMesh, spec: RacquetSpec, tc: TrimContext, f: number, z: number): number {
  const p = rimAt(tc.ctx, f, 1, tc.sJ);
  const { points, centre } = outerSection(spec, p.u, GROMMET_OUT + PORT_RAISE, GROMMET_FACE + PORT_RAISE);
  const x = centre + xAtZ(points, z);
  return m.vertex(p.x + p.nx * x, p.y + p.ny * x, z);
}

/** O-port: a flush oval on the grommet shell at fractional index f (right side; mirrored by the caller). */
function oPort(m: RawMesh, spec: RacquetSpec, tc: TrimContext, f: number): void {
  const t = beamThicknessAt(spec, rimAt(tc.ctx, f, 1, tc.sJ).u);
  const hz = (PORT_HALF_HEIGHT_FRACTION * t) / 2;
  const step = tc.ctx.arc[Math.floor(f) + 1] - tc.ctx.arc[Math.floor(f)];
  const c = shellPoint(m, spec, tc, f, 0);
  let prev: number[] = [];
  for (let r = 1; r <= PORT_RINGS; r++) {
    const rho = r / PORT_RINGS;
    const ring = Array.from({ length: PORT_SEGMENTS }, (_, k) => {
      const phi = (2 * Math.PI * k) / PORT_SEGMENTS;
      return shellPoint(m, spec, tc, f + (rho * PORT_HALF_LENGTH * Math.cos(phi)) / step, rho * hz * Math.sin(phi));
    });
    for (let k = 0; k < PORT_SEGMENTS; k++) {
      const k1 = (k + 1) % PORT_SEGMENTS;
      if (r === 1) m.tri(c, ring[k1], ring[k]);
      else {
        m.tri(prev[k], ring[k1], ring[k]);
        m.tri(prev[k], prev[k1], ring[k1]);
      }
    }
    prev = ring;
  }
}

/**
 * Grommet strip: the outer rim from the bumper's end down to the throat junction, both sides.
 * With `o-ports` the geometry also carries a `color` attribute (linear RGB, itemSize 3): the
 * grommet colour on the strip and PORT_DARKEN x that on the flush oval insets down each side.
 * With `paint: "frame"` on the part, the strip instead carries the frame's paint (zones included),
 * so stripes wrap over the rim; the insets keep the darkened grommet colour. Otherwise there is no
 * `color` attribute. The build step must set `vertexColors: true` on the grommets material exactly
 * when the attribute exists.
 */
export function buildGrommets(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const tc = trimContext(spec, layout);
  const paint = trimPaint(spec, 'grommets');
  const seams = paint ? paintSeams(spec) : [];
  const m = new RawMesh();
  const fEnd = Math.floor(tc.fJ);
  const flat: [number, number][] = Array.from({ length: GROMMET_GAPS_PER_SIDE + 1 }, () => [GROMMET_OUT - PORT_LIFT, GROMMET_FACE - PORT_LIFT]);
  const channel = spec.parts.grommets.channel ?? 1;
  strip(m, spec, ringsBetween(tc, tc.fB, fEnd, GROMMET_GAPS_PER_SIDE, 1, seams), flat, paint, channel);
  strip(m, spec, ringsBetween(tc, tc.fB, fEnd, GROMMET_GAPS_PER_SIDE, -1, seams).reverse(), flat, paint, channel);
  const stripVerts = m.vertexCount;
  if (!spec.geometry.features.includes('o-ports')) return m.build();
  const ports = new RawMesh();
  let widest = 0;
  for (let i = 1; i < tc.ctx.inner.length; i++) if (tc.ctx.inner[i].x > tc.ctx.inner[widest].x) widest = i;
  const step = tc.ctx.arc[1] - tc.ctx.arc[0]; // outline samples are evenly spaced
  // Centre the row on the widest point, kept between the bumper's end and the throat junction:
  // slide it along the rim if it overhangs either end, and close it up if the rim is too short.
  const margin = (PORT_HALF_LENGTH * 1.2) / step;
  const lo = tc.fB + margin;
  const hi = tc.fJ - margin;
  const pitch = Math.min(PORT_PITCH / step, (hi - lo) / (PORTS_PER_SIDE - 1));
  const span = (PORTS_PER_SIDE - 1) * pitch;
  const first = Math.min(Math.max(widest - span / 2, lo), hi - span);
  for (let k = 0; k < PORTS_PER_SIDE; k++) oPort(ports, spec, tc, first + k * pitch);
  ports.appendMirrorX();
  m.append(ports);
  // The o-port insets carry no frame paint: they are the grommet colour, darkened.
  const base = hexToLinear(spec.parts.grommets.color);
  if (paint) {
    for (let i = stripVerts; i < m.vertexCount; i++) m.colour(base[0] * PORT_DARKEN, base[1] * PORT_DARKEN, base[2] * PORT_DARKEN);
  } else {
    for (let i = 0; i < m.vertexCount; i++) {
      const k = i < stripVerts ? 1 : PORT_DARKEN;
      m.colour(base[0] * k, base[1] * k, base[2] * k);
    }
  }
  return m.build();
}

export const DAMPENER_WIDTH = 0.011;
export const DAMPENER_HEIGHT = 0.008;
export const DAMPENER_DEPTH = 0.007;
export const DAMPENER_CORNER = 0.0025;
export const DAMPENER_SEGMENTS = 3;

/**
 * Dampener: a small rounded block between the two centre mains, just above the bridge. For odd
 * main counts "the centre two" are the middle string and the one to its right.
 */
export function buildDampener(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry | null {
  if (!spec.parts.dampener) return null;
  const bed = stringBed(spec, layout);
  const xs = mainPositions(spec.specs.stringPattern[0], bed.width * 0.9);
  const mid = xs.length >> 1;
  const [x0, x1] = xs.length % 2 === 0 ? [xs[mid - 1], xs[mid]] : [xs[mid], xs[mid + 1]];
  const xc = (x0 + x1) / 2;
  const w = Math.min(DAMPENER_WIDTH, (x1 - x0) * 0.7);
  const h = DAMPENER_HEIGHT;
  const r = Math.min(DAMPENER_CORNER, w / 3);
  const yc = bed.lowerY(xc) + 0.004 + h / 2;
  // Rounded rectangle outline, counter-clockwise seen from +Z.
  const corners: [number, number, number][] = [[w / 2 - r, -h / 2 + r, -Math.PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI]];
  const outline: [number, number][] = [];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= DAMPENER_SEGMENTS; k++) {
      const a = a0 + ((Math.PI / 2) * k) / DAMPENER_SEGMENTS;
      outline.push([xc + cx + r * Math.cos(a), yc + cy + r * Math.sin(a)]);
    }
  }
  const m = new RawMesh();
  const n = outline.length;
  const zs = [-DAMPENER_DEPTH / 2, DAMPENER_DEPTH / 2];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % n];
    const q = [m.vertex(ax, ay, zs[0]), m.vertex(bx, by, zs[0]), m.vertex(bx, by, zs[1]), m.vertex(ax, ay, zs[1])];
    m.tri(q[0], q[1], q[2]);
    m.tri(q[0], q[2], q[3]);
  }
  for (const [z, front] of [[zs[1], true], [zs[0], false]] as const) {
    const c = m.vertex(xc, yc, z);
    const ring = outline.map(([x, y]) => m.vertex(x, y, z));
    for (let i = 0; i < n; i++) {
      if (front) m.tri(c, ring[i], ring[(i + 1) % n]);
      else m.tri(c, ring[(i + 1) % n], ring[i]);
    }
  }
  return m.build();
}
