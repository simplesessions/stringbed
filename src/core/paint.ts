import * as THREE from 'three';
import { hexToLinear } from './color';
import type { RacquetSpec } from './spec';

export { hexToLinear } from './color';

type Paint = RacquetSpec['paint'];
type RGB = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Linear-RGB colour at frame coordinate u, before any pattern: base, overridden by zones in order
 * (later wins). A zone's `blend` fades it in and out *inside* its [from, to] edges, so a zone never
 * reaches past the published extent. An edge sitting on the frame end (from <= 0, to >= 1) does not
 * fade, since there is nothing beyond it to fade into.
 */
export function paintColorAt(paint: Paint, u: number): RGB {
  let c = hexToLinear(paint.base);
  for (const z of paint.zones) {
    if (u < z.from || u > z.to) continue;
    const b = z.blend ?? 0;
    let w = 1;
    if (b > 0) {
      if (z.from > 0) w = Math.min(w, (u - z.from) / b);
      if (z.to < 1) w = Math.min(w, (z.to - u) / b);
    }
    c = mix(c, hexToLinear(z.color), clamp01(w));
  }
  return c;
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
 * the racquet, z through the thickness). The cells are tall (y) and thin through z, so on the long
 * sides of the hoop blobs run lengthwise as stripes, while the narrow cell in z flips front and back
 * faces and the rim independently so stripes wrap the beam rather than ignoring it.
 */
const CELL_M = { x: 0.022, y: 0.05, z: 0.012 };
const CAMO_THRESHOLD = 0.55;

/** Camo field in 0..1 at a vertex position: value noise plus a light fine octave for ragged edges. */
function camoField(x: number, y: number, z: number, scale: number, seed: number): number {
  const px = (x / CELL_M.x) * scale, py = (y / CELL_M.y) * scale, pz = (z / CELL_M.z) * scale;
  const coarse = valueNoise(px, py, pz, seed);
  const fine = valueNoise(px * 2.3 + 40, py * 2.3, pz * 2.3, seed + 101);
  return coarse * 0.85 + fine * 0.15;
}

/** Adds a "color" attribute (itemSize 3, linear RGB) to the frame: zones first, then the pattern. */
export function applyPaint(frame: THREE.BufferGeometry, paint: Paint): void {
  const pos = frame.getAttribute('position');
  const uAttr = frame.getAttribute('u');
  if (!uAttr) throw new Error('applyPaint: frame needs a "u" attribute (use buildFrame output)');
  const out = new Float32Array(pos.count * 3);
  const pat = paint.pattern;
  const patColor = pat ? hexToLinear(pat.color) : null;
  for (let i = 0; i < pos.count; i++) {
    const u = uAttr.getX(i);
    let c = paintColorAt(paint, u);
    if (pat && patColor && camoField(pos.getX(i), pos.getY(i), pos.getZ(i), pat.scale, pat.seed) > CAMO_THRESHOLD) c = patColor;
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
  }
  frame.setAttribute('color', new THREE.BufferAttribute(out, 3));
}
