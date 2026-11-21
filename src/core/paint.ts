import * as THREE from 'three';
import { hexToLinear } from './color';
import type { BeamFace, RacquetSpec } from './spec';

export { hexToLinear } from './color';

type Paint = RacquetSpec['paint'];
type RGB = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Weight (0..1) of a zone at u: 1 inside, fading to 0 across `blend` at an edge not on a frame end. */
function zoneWeight(z: Paint['zones'][number], u: number): number {
  if (u < z.from || u > z.to) return 0;
  const b = z.blend ?? 0;
  let w = 1;
  if (b > 0) {
    if (z.from > 0) w = Math.min(w, (u - z.from) / b);
    if (z.to < 1) w = Math.min(w, (z.to - u) / b);
  }
  return clamp01(w);
}

/** The face of the beam a section position (see the frame's "side" attribute) lies on. */
export function faceAt(sx: number, sz: number): BeamFace {
  if (Math.abs(sx) >= Math.abs(sz)) return sx >= 0 ? 'outer' : 'inner';
  return sz >= 0 ? 'front' : 'back';
}

/**
 * Linear-RGB colour at frame coordinate u, before any pattern: base, overridden by zones in order
 * (later wins). A zone with `faces` applies only where `face` is one of them; with no face given
 * (trim parts) such zones are skipped. A zone's `blend` fades it in and out *inside* its [from, to] edges, so a zone never
 * reaches past the published extent. An edge sitting on the frame end (from <= 0, to >= 1) does not
 * fade, since there is nothing beyond it to fade into.
 */
export function paintColorAt(paint: Paint, u: number, face?: BeamFace): RGB {
  let c = hexToLinear(paint.base);
  for (const z of paint.zones) {
    if (z.faces && !(face && z.faces.includes(face))) continue;
    const w = zoneWeight(z, u);
    if (w > 0) c = mix(c, hexToLinear(z.color), w);
  }
  return c;
}

/** True where a zone covers u at least half strength. The pattern paints only the base, never a zone. */
export function zonedAt(paint: Paint, u: number, face?: BeamFace): boolean {
  return paint.zones.some((z) => (!z.faces || (face !== undefined && z.faces.includes(face))) && zoneWeight(z, u) >= 0.5);
}

/** 32-bit integer hash of a lattice point and seed (no Math.random; fully deterministic). */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth 3D value noise in 0..1. */
function valueNoise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = smooth(x - xi), fy = smooth(y - yi), fz = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const at = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(at(0, 0, 0), at(1, 0, 0), fx), lerp(at(0, 1, 0), at(1, 1, 0), fx), fy),
    lerp(lerp(at(0, 0, 1), at(1, 0, 1), fx), lerp(at(0, 1, 1), at(1, 1, 1), fx), fy),
    fz,
  );
}

/**
 * Noise cell size (metres) at scale 1, per axis of the frame's own space (x across the head, y along
 * the racquet, z through the thickness). Tiger camo runs in horizontal streaks, so cells are long in x
 * and short in y: on the sides of the hoop the streaks cross the beam, across the top and bottom they
 * run along it. y is kept near two hoop ring spacings, the finest detail vertex colours can hold. The
 * narrow cell in z flips the front and back faces and the rim independently so streaks wrap the beam.
 */
const CELL_M = { x: 0.04, y: 0.019, z: 0.008 };
const CAMO_THRESHOLD = 0.46;

/** Camo field in 0..1 at a vertex position: value noise plus a fine octave for ragged, broken edges. */
function camoField(x: number, y: number, z: number, scale: number, seed: number): number {
  const px = (x / CELL_M.x) * scale, py = (y / CELL_M.y) * scale, pz = (z / CELL_M.z) * scale;
  const coarse = valueNoise(px, py, pz, seed);
  const fine = valueNoise(px * 2.7 + 40, py * 1.9, pz * 2.3, seed + 101);
  return coarse * 0.7 + fine * 0.3;
}

/** Adds a "color" attribute (itemSize 3, linear RGB) to the frame: zones first, then the pattern on the bare base. */
export function applyPaint(frame: THREE.BufferGeometry, paint: Paint): void {
  const pos = frame.getAttribute('position');
  const uAttr = frame.getAttribute('u');
  const sideAttr = frame.getAttribute('side');
  if (!uAttr) throw new Error('applyPaint: frame needs a "u" attribute (use buildFrame output)');
  const out = new Float32Array(pos.count * 3);
  const pat = paint.pattern;
  const patColor = pat ? hexToLinear(pat.color) : null;
  for (let i = 0; i < pos.count; i++) {
    const u = uAttr.getX(i);
    const face = sideAttr ? faceAt(sideAttr.getX(i), sideAttr.getY(i)) : undefined;
    let c = paintColorAt(paint, u, face);
    if (pat && patColor && !zonedAt(paint, u, face) && camoField(pos.getX(i), pos.getY(i), pos.getZ(i), pat.scale, pat.seed) > CAMO_THRESHOLD) c = patColor;
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
  }
  frame.setAttribute('color', new THREE.BufferAttribute(out, 3));
}
