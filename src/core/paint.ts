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

/** Noise cell length along the frame (metres) and across the section (in unit-normal space) at scale 1. */
const CELL_ALONG_M = 0.045;
const CELL_ACROSS = 0.7;

/**
 * Camo field in 0..1 for one vertex. Value noise in (arc length along the frame, section normal):
 * arc length is u times the frame's approximate arc length, so blobs run along the beam wherever the
 * hoop turns; the unit normal places the vertex around the section, giving a few blobs per ring.
 * Two octaves give ragged tiger-stripe edges.
 */
function camoField(u: number, nx: number, ny: number, nz: number, arcM: number, scale: number, seed: number): number {
  const along = ((u * arcM) / CELL_ALONG_M) * scale;
  const k = scale / CELL_ACROSS;
  const coarse = valueNoise(along, nx * k + 17.3, ny * k + nz * k * 1.3 - 5.1, seed);
  const fine = valueNoise(along * 2.1 + 40, (nx * k + 3.7) * 2.1, (ny * k + nz * k * 1.3) * 2.1, seed + 101);
  return coarse * 0.7 + fine * 0.3;
}

const CAMO_THRESHOLD = 0.5;

/** Adds a "color" attribute (itemSize 3, linear RGB) to the frame: zones first, then the pattern. */
export function applyPaint(frame: THREE.BufferGeometry, paint: Paint): void {
  const pos = frame.getAttribute('position');
  const nor = frame.getAttribute('normal');
  const uAttr = frame.getAttribute('u');
  const out = new Float32Array(pos.count * 3);
  frame.computeBoundingBox();
  // The hoop is traversed twice (up one side, over the top, down the other), plus shaft and bridge.
  const arcM = 2 * (frame.boundingBox!.max.y - frame.boundingBox!.min.y);
  const pat = paint.pattern;
  const patColor = pat ? hexToLinear(pat.color) : null;
  for (let i = 0; i < pos.count; i++) {
    const u = uAttr.getX(i);
    let c = paintColorAt(paint, u);
    if (pat && patColor && camoField(u, nor.getX(i), nor.getY(i), nor.getZ(i), arcM, pat.scale, pat.seed) > CAMO_THRESHOLD) c = patColor;
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
  }
  frame.setAttribute('color', new THREE.BufferAttribute(out, 3));
}
