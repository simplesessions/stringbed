import type { Vec2 } from './outline';
import type { BeamProfile } from './spec';

/**
 * In-plane (radial) extent of the hoop beam, metres. The hoop's inner edge is the string-bed
 * outline and its outer edge is this far outside it, so `computeLayout` needs the same value.
 * Aero is the widest: its flattened, wide section is the Pure Aero's signature.
 */
export const HOOP_RADIAL: Record<BeamProfile, number> = {
  box: 0.0105,
  'tapered-box': 0.0105,
  ellipse: 0.011,
  aero: 0.013,
};

/** Default tessellation for sections; the frame builder passes its own (see frame.ts). */
export const DEFAULT_ROUND_POINTS = 16; // ellipse and aero; multiple of 4
export const DEFAULT_BOX_CORNER_SEGMENTS = 3;

/** Box corner radius as a fraction of the smaller of radial and thickness. */
const BOX_CORNER = 0.28;
/**
 * Aero: x = |cos|^PINCH narrows the section toward the faces and z = |sin|^FLAT flattens the
 * sides. The curve stays tangent-continuous at z = +-t/2, but its curvature there is unbounded
 * (z falls off as |x|^1.25), so it is a pinched edge, not a rounded nose. With 16 points the two
 * facets either side of each edge point meet at about 54 degrees.
 */
const AERO_PINCH = 1.6;
const AERO_FLAT = 0.8;

export interface SectionDetail {
  roundPoints?: number;
  boxCornerSegments?: number;
}

/**
 * A section polygon plus smoothing information. `creases[i]` marks a point where the surface
 * normal is discontinuous: the sweep gives it two vertices so the faces either side shade flat.
 */
export interface BeamSectionLoop {
  points: Vec2[];
  creases: boolean[];
}

/** Exact unit-circle values at multiples of 90 degrees, so extents are exact. */
function unit(theta: number, quarter: number): [number, number] {
  const q = theta / (Math.PI / 2);
  if (Number.isInteger(quarter) && Math.abs(q - quarter) < 1e-12) {
    const k = ((quarter % 4) + 4) % 4;
    return [[1, 0], [0, 1], [-1, 0], [0, -1]][k] as [number, number];
  }
  return [Math.cos(theta), Math.sin(theta)];
}

function roundLoop(profile: 'ellipse' | 'aero', thickness: number, radial: number, n: number): BeamSectionLoop {
  if (n < 8 || n % 4 !== 0) throw new Error(`beamSection: round point count must be a multiple of 4 >= 8, got ${n}`);
  const a = radial / 2;
  const b = thickness / 2;
  const points: Vec2[] = [];
  const creases: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / n;
    const [c, s] = unit(theta, (4 * i) / n);
    if (profile === 'ellipse') {
      points.push({ x: a * c, y: b * s });
      creases.push(false);
    } else {
      points.push({ x: a * Math.sign(c) * Math.abs(c) ** AERO_PINCH, y: b * Math.sign(s) * Math.abs(s) ** AERO_FLAT });
      // Shading choice, not a geometric corner: crease the pinched edge points so each face shows
      // a crisp ridge line along the hoop instead of a smeared highlight.
      creases.push(i === n / 4 || i === (3 * n) / 4);
    }
  }
  return { points, creases };
}

function boxLoop(thickness: number, radial: number, k: number): BeamSectionLoop {
  if (k < 1) throw new Error(`beamSection: box corner segments must be >= 1, got ${k}`);
  const a = radial / 2;
  const b = thickness / 2;
  const r = BOX_CORNER * Math.min(radial, thickness);
  const centres: Vec2[] = [
    { x: a - r, y: b - r },
    { x: -(a - r), y: b - r },
    { x: -(a - r), y: -(b - r) },
    { x: a - r, y: -(b - r) },
  ];
  const points: Vec2[] = [];
  const creases: boolean[] = [];
  for (let q = 0; q < 4; q++) {
    for (let j = 0; j <= k; j++) {
      const theta = (Math.PI / 2) * (q + j / k);
      const [c, s] = unit(theta, j === 0 ? q : j === k ? q + 1 : 0.5);
      points.push({ x: centres[q].x + r * c, y: centres[q].y + r * s });
      creases.push(j === 0 || j === k); // flat faces meet the rounded corners at a crease
    }
  }
  return { points, creases };
}

/**
 * Section polygon with crease flags. (x, y) = (radial, z), metres, centred on the origin,
 * counter-clockwise. The radial extent is exactly `radial` and the z extent exactly `thickness`.
 * `tapered-box` has the same section as `box`; its radial narrowing is applied by the frame.
 */
export function beamSectionLoop(
  profile: BeamProfile,
  thickness: number,
  radial: number,
  detail: SectionDetail = {},
): BeamSectionLoop {
  switch (profile) {
    case 'box':
    case 'tapered-box':
      return boxLoop(thickness, radial, detail.boxCornerSegments ?? DEFAULT_BOX_CORNER_SEGMENTS);
    case 'ellipse':
    case 'aero':
      return roundLoop(profile, thickness, radial, detail.roundPoints ?? DEFAULT_ROUND_POINTS);
  }
}

// Cross-section polygon in (radial, z) metres, centred on the origin, counter-clockwise.
// thickness is the published beam width (z extent); radial is the in-plane extent.
export function beamSection(profile: BeamProfile, thickness: number, radial: number): Vec2[] {
  return beamSectionLoop(profile, thickness, radial).points;
}

/**
 * Widen a section by `shift` on each side: points with x > 0 move +shift, x < 0 move -shift,
 * and points on x = 0 split in two, leaving a flat run across the top and bottom. Used for the
 * shaft, which must enclose the two throat arms side by side where they merge into it.
 */
export function stretchSection(loop: BeamSectionLoop, shift: number): BeamSectionLoop {
  const points: Vec2[] = [];
  const creases: boolean[] = [];
  const n = loop.points.length;
  for (let i = 0; i < n; i++) {
    const p = loop.points[i];
    if (p.x !== 0) {
      points.push({ x: p.x + Math.sign(p.x) * shift, y: p.y });
      creases.push(loop.creases[i]);
      continue;
    }
    const prev = loop.points[(i + n - 1) % n];
    const first = prev.x > 0 ? 1 : -1;
    points.push({ x: first * shift, y: p.y }, { x: -first * shift, y: p.y });
    creases.push(loop.creases[i], loop.creases[i]);
  }
  return { points, creases };
}
