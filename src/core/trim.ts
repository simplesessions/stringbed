import * as THREE from 'three';
import {
  beamRadialAt,
  beamThicknessAt,
  BOX_CORNER_SEGMENTS,
  findJunction,
  frameContext,
  ROUND_SECTION_POINTS,
  U_JUNCTION,
  type FrameContext,
} from './frame';
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
const PORT_OUT = 0.0004;

/** Bumper spans +-60 degrees about the head centre (10 to 2 o'clock). */
const BUMPER_HALF_ANGLE = Math.PI / 3;
const BUMPER_GAPS_PER_SIDE = 14;
const GROMMET_GAPS_PER_SIDE = 14;
/** Aero fins: angles from the tip on each side, and the half-width of a fin in outline samples. */
const FIN_ANGLES = [(15 * Math.PI) / 180, (35 * Math.PI) / 180, (55 * Math.PI) / 180];
const FIN_HALF_SAMPLES = 1.2;
/** O-port: an oval dome at 3 and 9 o'clock. Half-length along the hoop, half-height as a fraction of beam thickness. */
const PORT_HALF_LENGTH = 0.011;
const PORT_HALF_HEIGHT_FRACTION = 0.4;
const PORT_SEGMENTS = 12;

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

/** The outer half of a hoop section (radial x >= 0), inflated by (ex, ez) at its extremes. */
function outerSection(spec: RacquetSpec, u: number, ex: number, ez: number): { points: Vec2[]; centre: number } {
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
  return { points, centre: r / 2 };
}

/** Sweep an open strip over the outer rim through the given points; `infl` gives (ex, ez) per point. */
function strip(m: RawMesh, spec: RacquetSpec, pts: RimPoint[], infl: [number, number][]): void {
  let prev: number[] | null = null;
  pts.forEach((p, k) => {
    const { points, centre } = outerSection(spec, p.u, infl[k][0], infl[k][1]);
    const row = points.map((s) => m.vertex(p.x + p.nx * (centre + s.x), p.y + p.ny * (centre + s.x), s.y));
    if (prev) {
      for (let j = 0; j + 1 < row.length; j++) {
        m.tri(prev[j], prev[j + 1], row[j]);
        m.tri(prev[j + 1], row[j + 1], row[j]);
      }
    }
    prev = row;
  });
}

function ringsBetween(ctx: FrameContext, f0: number, f1: number, gaps: number, side: 1 | -1, sJ: number): RimPoint[] {
  return Array.from({ length: gaps + 1 }, (_, k) => rimAt(ctx, lerp(f0, f1, k / gaps), side, sJ));
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
function fin(m: RawMesh, spec: RacquetSpec, tc: TrimContext, f: number, side: 1 | -1): void {
  const fs = [f - FIN_HALF_SAMPLES, f, f + FIN_HALF_SAMPLES];
  const pts = fs.map((q) => rimAt(tc.ctx, Math.max(0, q), side, tc.sJ));
  // Keep the sweep clockwise: the left side runs up toward the tip.
  const infl: [number, number][] = [[BUMPER_OUT, BUMPER_FACE], [FIN_OUT, FIN_FACE], [BUMPER_OUT, BUMPER_FACE]];
  if (side === 1) strip(m, spec, pts, infl);
  else strip(m, spec, pts.reverse(), infl);
}

/** Bumper over the top (10 to 2 o'clock), plus aero fins when the spec has them. */
export function buildBumper(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const tc = trimContext(spec, layout);
  const m = new RawMesh();
  const right = ringsBetween(tc.ctx, 0, tc.fB, BUMPER_GAPS_PER_SIDE, 1, tc.sJ);
  const left = ringsBetween(tc.ctx, 0, tc.fB, BUMPER_GAPS_PER_SIDE, -1, tc.sJ).reverse();
  const path = [...left, ...right.slice(1)]; // clockwise: up the left, over the tip, down the right
  strip(m, spec, path, path.map(() => [BUMPER_OUT, BUMPER_FACE]));
  if (spec.geometry.features.includes('aero-fins')) {
    for (const angle of FIN_ANGLES) {
      const f = indexAtAngle(tc.ctx, angle);
      fin(m, spec, tc, f, 1);
      fin(m, spec, tc, f, -1);
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

/** O-port: a shallow oval dome on the outer wall at fractional index f (right side, mirrored later). */
function oPort(m: RawMesh, spec: RacquetSpec, tc: TrimContext, f: number): void {
  const p = rimAt(tc.ctx, f, 1, tc.sJ);
  const { points, centre } = outerSection(spec, p.u, GROMMET_OUT, GROMMET_FACE);
  const t = beamThicknessAt(spec, p.u);
  const hz = (PORT_HALF_HEIGHT_FRACTION * t) / 2;
  // Tangent along the hoop (clockwise), so the oval's long axis follows the rim.
  const tx = p.ny;
  const ty = -p.nx;
  const at = (n: number, along: number, z: number) =>
    m.vertex(p.x + p.nx * (centre + n) + tx * along, p.y + p.ny * (centre + n) + ty * along, z);
  const c = at(Math.max(...points.map((q) => q.x)) + (PORT_OUT - GROMMET_OUT), 0, 0);
  const ring = Array.from({ length: PORT_SEGMENTS }, (_, k) => {
    const phi = (2 * Math.PI * k) / PORT_SEGMENTS;
    const z = hz * Math.sin(phi);
    return at(xAtZ(points, z) + 0.0001, PORT_HALF_LENGTH * Math.cos(phi), z);
  });
  for (let k = 0; k < PORT_SEGMENTS; k++) m.tri(c, ring[(k + 1) % PORT_SEGMENTS], ring[k]);
}

/**
 * Grommet strip: the outer rim from the bumper's end down to the throat junction, both sides.
 * With `o-ports`, two oval domes at 3 and 9 o'clock, kept as geometry group 1 (strip is group 0) so
 * a style can darken them.
 */
export function buildGrommets(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const tc = trimContext(spec, layout);
  const m = new RawMesh();
  const fEnd = Math.floor(tc.fJ);
  const flat: [number, number][] = Array.from({ length: GROMMET_GAPS_PER_SIDE + 1 }, () => [GROMMET_OUT, GROMMET_FACE]);
  strip(m, spec, ringsBetween(tc.ctx, tc.fB, fEnd, GROMMET_GAPS_PER_SIDE, 1, tc.sJ), flat);
  strip(m, spec, ringsBetween(tc.ctx, tc.fB, fEnd, GROMMET_GAPS_PER_SIDE, -1, tc.sJ).reverse(), flat);
  const stripIndices = m.indices.length;
  if (spec.geometry.features.includes('o-ports')) {
    const ports = new RawMesh();
    let widest = 0;
    for (let i = 1; i < tc.ctx.inner.length; i++) if (tc.ctx.inner[i].x > tc.ctx.inner[widest].x) widest = i;
    oPort(ports, spec, tc, widest);
    ports.appendMirrorX();
    m.append(ports);
  }
  const g = m.build();
  g.addGroup(0, stripIndices, 0);
  if (m.indices.length > stripIndices) g.addGroup(stripIndices, m.indices.length - stripIndices, 1);
  return g;
}

const DAMPENER_WIDTH = 0.011;
const DAMPENER_HEIGHT = 0.008;
const DAMPENER_DEPTH = 0.007;
const DAMPENER_CORNER = 0.0025;
const DAMPENER_SEGMENTS = 3;

/** Dampener: a small rounded block between the two centre mains, just above the bridge. */
export function buildDampener(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry | null {
  if (!spec.parts.dampener) return null;
  const bed = stringBed(spec, layout);
  const xs = mainPositions(spec.specs.stringPattern[0], bed.width * 0.9);
  const mid = xs.length >> 1;
  const xc = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : (xs[mid] + xs[mid + 1]) / 2;
  const gap = xs.length % 2 === 0 ? xs[mid] - xs[mid - 1] : xs[mid + 1] - xs[mid];
  const w = Math.min(DAMPENER_WIDTH, gap * 0.7);
  const h = DAMPENER_HEIGHT;
  const r = Math.min(DAMPENER_CORNER, w / 3);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: DAMPENER_DEPTH, bevelEnabled: false, curveSegments: DAMPENER_SEGMENTS });
  g.translate(xc, bed.lowerY(xc) + 0.004 + h / 2, -DAMPENER_DEPTH / 2);
  return g;
}
