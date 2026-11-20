import * as THREE from 'three';
import type { Layout } from './layout';
import { headOutline, type Vec2 } from './outline';
import { beamSectionLoop, HOOP_RADIAL, stretchSection, type BeamSectionLoop, type SectionDetail } from './section';
import type { RacquetSpec } from './spec';

// ---------------------------------------------------------------------------------------------
// Tessellation density. Triangles = 2 x section edges x ring gaps; Task 8 may lower these to fit
// the 150 KB GLB budget. With the defaults the frame is about 3,200 triangles for every profile
// (box sections carry ~2,500 vertices because creases duplicate them; round ones ~1,700-1,900).
// ---------------------------------------------------------------------------------------------
/** Rings from the head tip down to each throat junction (one side of the hoop). */
export const HOOP_HALF_RINGS = 30;
/** Ring gaps along each throat arm, junction to shaft. */
export const ARM_RINGS = 10;
/** Ring gaps across the bridge, junction to junction (even). */
export const BRIDGE_RINGS = 14;
/** Ring gaps along the shaft, grip top to the arms' apex. */
export const SHAFT_RINGS = 4;
/** Points around ellipse and aero sections (multiple of 4). */
export const ROUND_SECTION_POINTS = 16;
/** Segments per rounded corner of box sections. */
export const BOX_CORNER_SEGMENTS = 3;
/** Dense samples of each arm's Bezier before rings are placed on it (not a mesh density). */
const ARM_CURVE_SAMPLES = 200;
/** Ring placement: metres of arc length that count the same as one radian of turning. */
const TURN_WEIGHT = 0.04;

// ---------------------------------------------------------------------------------------------
// Frame coordinate u. Paint zones use these reference regions: shaft 0-0.12, throat 0.12-0.35,
// lower hoop 0.35-0.55, sides 0.55-0.80, shoulders 0.80-0.93, tip 0.93-1.
//   shaft:  u = 0 at gripTopY to U_SHAFT at the apex where the arms merge, linear in y
//   arms:   U_SHAFT at the apex to U_JUNCTION where the arm meets the hoop, by arc length
//   hoop:   U_JUNCTION at the junction to 1 at the tip, by arc length of the inner outline
//   bridge: constant BRIDGE_U, just on the throat side of the junction, so it paints like the
//           top of the arms it joins (a blend straddling 0.35 would otherwise half-tint it)
// Both sides of the racquet share u.
// ---------------------------------------------------------------------------------------------
export const U_SHAFT = 0.12;
export const U_JUNCTION = 0.35;
export const BRIDGE_U = 0.34;

// ---------------------------------------------------------------------------------------------
// Shape parameters.
// ---------------------------------------------------------------------------------------------
/** Apex of the throat (where the arms merge into the shaft), as a fraction of gripTopY..bridgeY. */
const APEX_FRACTION = 0.3;
/**
 * Throat arms widen in-plane from the hoop's radial at the junction to ARM_WIDEN x that at the
 * apex, capped so the shaft (two arms wide) stays narrower than the grip.
 */
const ARM_WIDEN = 1.2;
const SHAFT_MAX_WIDTH = 0.025;
/** tapered-box: radial extent at the shaft as a fraction of the hoop's. */
const TAPER_MIN = 0.72;
/**
 * Throat arms. The junction is where the hoop's tangent aims at `apex + (0, aim)`; a lower aim
 * point raises the junction and steepens the arm, which with longer handles bows it outward (U).
 * `out` and `in` are cubic Bezier handle lengths as fractions of the junction-apex distance.
 */
const THROAT = {
  'open-v': { aim: 0.0, out: 0.45, in: 0.22 },
  'open-u': { aim: -0.07, out: 0.5, in: 0.45 },
} as const;
/** Flat bridge: its centre is raised by this fraction of the radial, and blends into the hoop. */
const FLAT_BRIDGE_RAISE = 0.7;
const FLAT_BRIDGE_SOFTNESS = 0.012; // metres; smooth-max width
/** The bridge is a hair smaller than the hoop so it nests inside it where they meet. */
const BRIDGE_INSET = 0.97;
/** The shaft is a hair wider than the two arms it holds, so their surfaces never coincide. */
const SHAFT_CLEARANCE = 0.0002;

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const MID_U = 0.65;

// Beam thickness in metres at frame coordinate u, interpolating spec.specs.beamMm:
// shaft value at u = 0, mid value at u = 0.65, tip value at u = 1 (smooth interpolation).
// Smoothstep segments have zero slope at the knots, so the curve never overshoots the published values.
export function beamThicknessAt(spec: RacquetSpec, u: number): number {
  const [tip, mid, shaft] = spec.specs.beamMm;
  const mm = u <= MID_U ? lerp(shaft, mid, smoothstep(u / MID_U)) : lerp(mid, tip, smoothstep((u - MID_U) / (1 - MID_U)));
  return mm / 1000;
}

/** In-plane beam extent in metres at frame coordinate u. Only `tapered-box` varies. */
export function beamRadialAt(spec: RacquetSpec, u: number): number {
  const profile = spec.geometry.beam.profile;
  const r = HOOP_RADIAL[profile];
  if (profile !== 'tapered-box') return r;
  return r * lerp(TAPER_MIN, 1, smoothstep((u - U_SHAFT) / (0.6 - U_SHAFT)));
}

export interface Ring {
  c: Vec2; // centre of the section, world XY
  t: Vec2; // unit tangent along the sweep direction
  u: number; // frame coordinate written to the vertices
  thickness: number;
  radial: number;
}

/** Mirror a right-hand ring to the left; the sweep runs the other way there, so flip t.y. */
const mirror = (r: Ring): Ring => ({ ...r, c: { x: -r.c.x, y: r.c.y }, t: { x: r.t.x, y: -r.t.y } });

const norm = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y);
  return { x: v.x / l, y: v.y / l };
};

/**
 * Choose `count + 1` positions along a dense polyline, evenly spaced in arc length plus
 * TURN_WEIGHT x turning angle (so tight curves get more rings). Endpoints included.
 * Returns fractional indices into `pts`.
 */
function placeRings(pts: Vec2[], count: number): number[] {
  const m = [0];
  for (let i = 1; i < pts.length; i++) {
    const ds = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let turn = 0;
    if (i >= 2) {
      const a = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
      const b = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      turn = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
    }
    m.push(m[i - 1] + ds + TURN_WEIGHT * turn);
  }
  const total = m[m.length - 1];
  const out: number[] = [];
  let j = 1;
  for (let k = 0; k <= count; k++) {
    const target = (total * k) / count;
    while (j < m.length - 1 && m[j] < target) j++;
    const span = m[j] - m[j - 1] || 1;
    out.push(j - 1 + Math.min(1, Math.max(0, (target - m[j - 1]) / span)));
  }
  out[0] = 0;
  out[count] = pts.length - 1;
  return out;
}

const at = <T>(arr: T[], f: number, mix: (a: T, b: T, t: number) => T): T => {
  const i = Math.min(arr.length - 2, Math.floor(f));
  return mix(arr[i], arr[i + 1], f - i);
};
const mixV = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const mixN = (a: number, b: number, t: number) => lerp(a, b, t);

/** Smooth maximum: >= max(a, b), within k/2 of it, C-infinity. Returns value and d/da. */
function smax(a: number, b: number, k: number): [number, number] {
  const d = a - b;
  const s = Math.sqrt(d * d + k * k);
  return [(a + b + s) / 2, (1 + d / s) / 2];
}

class MeshBuilder {
  positions: number[] = [];
  us: number[] = [];
  indices: number[] = [];

  /** Sweep sections along rings. Every ring's section must share point count and creases. */
  sweep(rings: Ring[], sectionOf: (r: Ring) => BeamSectionLoop): void {
    let prev: { inIdx: number[]; outIdx: number[] } | null = null;
    for (const ring of rings) {
      const sec = sectionOf(ring);
      const nx = -ring.t.y; // N = Z x T: in-plane, to the right of the sweep direction
      const ny = ring.t.x;
      const inIdx: number[] = [];
      const outIdx: number[] = [];
      for (let j = 0; j < sec.points.length; j++) {
        const p = sec.points[j];
        const x = ring.c.x + nx * p.x;
        const y = ring.c.y + ny * p.x;
        const copies = sec.creases[j] ? 2 : 1;
        const first = this.us.length;
        for (let k = 0; k < copies; k++) {
          this.positions.push(x, y, p.y);
          this.us.push(ring.u);
        }
        inIdx.push(first);
        outIdx.push(first + copies - 1);
      }
      if (prev) {
        const n = inIdx.length;
        for (let j = 0; j < n; j++) {
          const j1 = (j + 1) % n;
          const a = prev.outIdx[j];
          const b = prev.inIdx[j1];
          const c = outIdx[j];
          const d = inIdx[j1];
          // Section is CCW in (N, Z) and (T, N, Z) is right-handed, so this winding faces outward.
          this.indices.push(a, b, c, b, d, c);
        }
      }
      prev = { inIdx, outIdx };
    }
  }

  /**
   * Flat end cap over a ring, as a fan from the section centre (sections are star-shaped about
   * it). Faces along the ring's tangent when `facing` is +1, against it when -1. Own vertices,
   * so it shades flat.
   */
  cap(ring: Ring, sec: BeamSectionLoop, facing: 1 | -1): void {
    const nx = -ring.t.y;
    const ny = ring.t.x;
    const centre = this.us.length;
    this.positions.push(ring.c.x, ring.c.y, 0);
    this.us.push(ring.u);
    for (const p of sec.points) {
      this.positions.push(ring.c.x + nx * p.x, ring.c.y + ny * p.x, p.y);
      this.us.push(ring.u);
    }
    const n = sec.points.length;
    for (let j = 0; j < n; j++) {
      const a = centre + 1 + j;
      const b = centre + 1 + ((j + 1) % n);
      // A CCW section in (N, Z) has normal N x Z = T.
      if (facing === 1) this.indices.push(centre, a, b);
      else this.indices.push(centre, b, a);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('u', new THREE.Float32BufferAttribute(this.us, 1));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return g;
  }
}

function cubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): { p: Vec2; d: Vec2 } {
  const s = 1 - t;
  const p = {
    x: s * s * s * p0.x + 3 * s * s * t * p1.x + 3 * s * t * t * p2.x + t * t * t * p3.x,
    y: s * s * s * p0.y + 3 * s * s * t * p1.y + 3 * s * t * t * p2.y + t * t * t * p3.y,
  };
  const d = {
    x: 3 * s * s * (p1.x - p0.x) + 6 * s * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * s * s * (p1.y - p0.y) + 6 * s * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
  return { p, d };
}

/** Shared, read-only inputs for the region builders. Build with `frameContext`. */
export interface FrameContext {
  spec: RacquetSpec;
  layout: Layout;
  /** Inner outline, right half, world XY: index 0 = tip, last = bottom centre, clockwise. */
  inner: Vec2[];
  /** Unit clockwise tangent of the inner outline at each `inner` point. */
  tangents: Vec2[];
  /** Cumulative arc length of `inner`. */
  arc: number[];
  /** In-plane width of each arm where it meets the shaft (the shaft holds two). */
  armR: number;
  /** Right arm's centre where it meets the shaft; the left is its mirror. */
  apex: Vec2;
}

export function frameContext(spec: RacquetSpec, layout: Layout): FrameContext {
  // 256 points match computeLayout, so the hoop's outer tip lands exactly on layout.tipY.
  const { shape, aspect } = spec.geometry.head;
  const loop = headOutline(shape, spec.specs.headSizeSqIn, aspect, 256).map((p) => ({ x: p.x, y: p.y + layout.headCenterY }));
  const half = loop.length / 2;
  const inner = loop.slice(0, half + 1);
  const tangents = inner.map((_, i) => norm({
    x: loop[(i + 1) % loop.length].x - loop[(i - 1 + loop.length) % loop.length].x,
    y: loop[(i + 1) % loop.length].y - loop[(i - 1 + loop.length) % loop.length].y,
  }));
  const arc = [0];
  for (let i = 1; i < inner.length; i++) arc.push(arc[i - 1] + Math.hypot(inner[i].x - inner[i - 1].x, inner[i].y - inner[i - 1].y));
  const armR = Math.min(ARM_WIDEN * beamRadialAt(spec, U_SHAFT), SHAFT_MAX_WIDTH / 2);
  const apex: Vec2 = { x: armR / 2, y: lerp(layout.gripTopY, layout.bridgeY, APEX_FRACTION) };
  return { spec, layout, inner, tangents, arc, armR, apex };
}

/** Centreline point and tangent for an inner-outline position (fractional index) and radial extent. */
function centreAt(ctx: FrameContext, f: number, r: number): { c: Vec2; t: Vec2 } {
  const p = at(ctx.inner, f, mixV);
  const t = norm(at(ctx.tangents, f, mixV));
  return { c: { x: p.x - (t.y * r) / 2, y: p.y + (t.x * r) / 2 }, t }; // outward normal = (-t.y, t.x)
}

/** Arm radial: the hoop's at the junction, widening to `armR` at the apex. */
function armRadialAt(ctx: FrameContext, u: number): number {
  return lerp(ctx.armR, beamRadialAt(ctx.spec, u), smoothstep((u - U_SHAFT) / (U_JUNCTION - U_SHAFT)));
}

/**
 * Throat junction, as a fractional index into `ctx.inner`: the first point below the widest
 * point where the hoop centreline's tangent aims at the throat style's target near the apex.
 */
export function findJunction(ctx: FrameContext): number {
  const { inner, apex, spec } = ctx;
  const throat = THROAT[spec.geometry.throat.style];
  const target: Vec2 = { x: apex.x, y: apex.y + throat.aim };
  const rJ = beamRadialAt(spec, U_JUNCTION);
  const aim = (f: number) => {
    const { c, t } = centreAt(ctx, f, rJ);
    return t.x * (target.y - c.y) - t.y * (target.x - c.x);
  };
  const half = inner.length - 1;
  let widest = 0;
  for (let i = 1; i <= half; i++) if (inner[i].x > inner[widest].x) widest = i;
  let fJ = -1;
  for (let i = widest + 1; i <= half && fJ < 0; i++) {
    const a = aim(i - 1);
    const b = aim(i);
    if (a < 0 && b >= 0) {
      fJ = i - 1 + a / (a - b);
    }
  }
  // A point below a convex head always has a tangent on the lower right quarter of the hoop.
  if (fJ < 0) throw new Error(`buildFrame: ${spec.id}: no throat junction found`);
  return fJ;
}

/** Right half of the hoop, tip to junction (last ring is at the junction, u = U_JUNCTION). */
export function hoopRings(ctx: FrameContext, fJ: number): Ring[] {
  const { inner, spec } = ctx;
  const arcAt = (f: number) => at(ctx.arc, f, mixN);
  const sJ = arcAt(fJ);
  const cJ = Math.ceil(fJ);
  const hoopDense = inner.slice(0, cJ + 1);
  hoopDense[hoopDense.length - 1] = at(inner, fJ, mixV);
  // Map a fractional index into hoopDense (last point replaced by the junction) back to `inner`.
  const hoopF = (g: number) => (g <= cJ - 1 ? g : cJ - 1 + (g - (cJ - 1)) * (fJ - (cJ - 1)));
  const rings: Ring[] = placeRings(hoopDense, HOOP_HALF_RINGS).map((g) => {
    const f = hoopF(g);
    const u = 1 - ((1 - U_JUNCTION) * arcAt(f)) / sJ;
    const r = beamRadialAt(spec, u);
    return { ...centreAt(ctx, f, r), u, thickness: beamThicknessAt(spec, u), radial: r };
  });
  rings[0].t = { x: 1, y: 0 }; // exact at the tip, by symmetry
  rings[0].c.x = 0;
  return rings;
}

/**
 * Right arm, after the junction ring down to the apex: a cubic leaving the junction along the
 * hoop's tangent and arriving at the apex heading straight down.
 */
export function armRings(ctx: FrameContext, junction: Ring): Ring[] {
  const { apex, spec } = ctx;
  const throat = THROAT[spec.geometry.throat.style];
  const L = Math.hypot(junction.c.x - apex.x, junction.c.y - apex.y);
  const p1 = { x: junction.c.x + junction.t.x * throat.out * L, y: junction.c.y + junction.t.y * throat.out * L };
  const p2 = { x: apex.x, y: apex.y + throat.in * L };
  const armDense: Vec2[] = [];
  const armTangent: Vec2[] = [];
  for (let i = 0; i <= ARM_CURVE_SAMPLES; i++) {
    const { p, d } = cubic(junction.c, p1, p2, apex, i / ARM_CURVE_SAMPLES);
    armDense.push(p);
    armTangent.push(norm(d));
  }
  const armArc = [0];
  for (let i = 1; i < armDense.length; i++) armArc.push(armArc[i - 1] + Math.hypot(armDense[i].x - armDense[i - 1].x, armDense[i].y - armDense[i - 1].y));
  const armLen = armArc[armArc.length - 1];
  const rings: Ring[] = placeRings(armDense, ARM_RINGS).slice(1).map((f) => {
    const u = U_JUNCTION - ((U_JUNCTION - U_SHAFT) * at(armArc, f, mixN)) / armLen;
    const r = armRadialAt(ctx, u);
    return { c: at(armDense, f, mixV), t: norm(at(armTangent, f, mixV)), u, thickness: beamThicknessAt(spec, u), radial: r };
  });
  rings[rings.length - 1].t = { x: 0, y: -1 };
  return rings;
}

/**
 * The whole bridge, right junction to left junction across the bottom. `curved` follows the
 * outline; `flat` is the same curve pushed up through a smooth max, so its middle runs level.
 * u is BRIDGE_U throughout, but the section is sized from U_JUNCTION (then inset) so it matches
 * the hoop ring it branches from and nests inside it; thickness is continuous there either way.
 */
export function bridgeRings(ctx: FrameContext, fJ: number): Ring[] {
  const { inner, spec, layout } = ctx;
  const cJ = Math.ceil(fJ);
  const rB = beamRadialAt(spec, U_JUNCTION) * BRIDGE_INSET;
  const tB = beamThicknessAt(spec, U_JUNCTION) * BRIDGE_INSET;
  // bridgeDense[0] is the junction, bridgeDense[k >= 1] is inner[cJ + k - 1].
  const bridgeDense = [at(inner, fJ, mixV), ...inner.slice(cJ)];
  const bridgeF = placeRings(bridgeDense, BRIDGE_RINGS / 2).map((g) => (g <= 1 ? fJ + (cJ - fJ) * g : cJ + g - 1));
  const flatY = layout.bridgeY - rB / 2 + FLAT_BRIDGE_RAISE * rB;
  const right: Ring[] = bridgeF.map((f) => {
    let { c, t } = centreAt(ctx, f, rB);
    if (spec.geometry.throat.bridge === 'flat') {
      const [y, dy] = smax(c.y, flatY, FLAT_BRIDGE_SOFTNESS);
      c = { x: c.x, y };
      t = norm({ x: t.x, y: t.y * dy });
    }
    return { c, t, u: BRIDGE_U, thickness: tB, radial: rB };
  });
  const bottom = right[right.length - 1];
  bottom.c.x = 0;
  bottom.t = { x: -1, y: 0 };
  return [...right, ...right.slice(0, -1).reverse().map(mirror)];
}

/** Shaft rings, gripTopY (u = 0) up to the apex (u = U_SHAFT). */
export function shaftRings(ctx: FrameContext): Ring[] {
  const { layout, apex, armR, spec } = ctx;
  const rings: Ring[] = [];
  for (let k = 0; k <= SHAFT_RINGS; k++) {
    const y = lerp(layout.gripTopY, apex.y, k / SHAFT_RINGS);
    const u = (U_SHAFT * k) / SHAFT_RINGS;
    rings.push({ c: { x: 0, y }, t: { x: 0, y: 1 }, u, thickness: beamThicknessAt(spec, u), radial: armR });
  }
  return rings;
}

// One merged BufferGeometry: hoop + two throat arms + bridge + shaft down to gripTopY.
// Attributes: position, normal, and a float attribute "u" (itemSize 1) with the frame coordinate per vertex.
//
// Construction (all in the XY plane, sections extruded in Z):
// - main tube: one sweep from the left apex, up the left arm, round the hoop over the tip, and
//   down the right arm to the right apex. The hoop part is the section offset outward from the
//   inner outline (inner edge on the outline); the arms leave the hoop tangentially.
// - bridge: a second sweep across the bottom of the head between the two junctions.
// - shaft: a third sweep from gripTopY up to the apex, wide enough to hold both arms, capped at
//   both ends (the top cap is the floor of the V the arms stand on).
// Only the right half is computed; the left half is its exact mirror.
export function buildFrame(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const profile = spec.geometry.beam.profile;
  const detail: SectionDetail = { roundPoints: ROUND_SECTION_POINTS, boxCornerSegments: BOX_CORNER_SEGMENTS };
  const sectionOf = (r: Ring) => beamSectionLoop(profile, r.thickness, r.radial, detail);
  const ctx = frameContext(spec, layout);
  const fJ = findJunction(ctx);
  const hoop = hoopRings(ctx, fJ);
  const right = [...hoop, ...armRings(ctx, hoop[hoop.length - 1])];

  const mesh = new MeshBuilder();
  mesh.sweep([...right.slice(1).reverse().map(mirror), ...right], sectionOf);
  mesh.sweep(bridgeRings(ctx, fJ), sectionOf);

  // The shaft holds both arms side by side. The arms stand on its top cap, which closes the
  // floor of the V; the bottom cap closes it inside the grip.
  const { armR } = ctx;
  const shaftLoop = (r: Ring) => stretchSection(beamSectionLoop(profile, r.thickness, armR, detail), armR / 2 + SHAFT_CLEARANCE);
  const shaft = shaftRings(ctx);
  mesh.sweep(shaft, shaftLoop);
  mesh.cap(shaft[0], shaftLoop(shaft[0]), -1);
  mesh.cap(shaft[SHAFT_RINGS], shaftLoop(shaft[SHAFT_RINGS]), 1);

  return mesh.build();
}
