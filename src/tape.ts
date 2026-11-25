import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3, type Object3D } from 'three';
import { HOOP_RADIAL } from './core/section';
import type { Beds } from './restring';

/** h: the hoop. l / r: the outer side of the left / right arm or handle. */
export type TapeZone = 'h' | 'l' | 'r';
/** at: h in degrees 0-359 clockwise from 12 o'clock, l/r in mm from the butt. Both are the piece's middle. */
export interface TapePiece { zone: TapeZone; at: number; mirrored: boolean; lengthMm: number; layers: number }
/** A piece as it lies, racquet space. `piece` is the one asked for, also on the mirrored side. */
export interface PlacedTape { piece: TapePiece; path: Vector3[]; normals: Vector3[]; centroid: Vector3 }

/** Tape on the hoop sits beside the strings: this far in front of them, or behind if the front has no room. */
const BESIDE_STRINGS = 0.005;
/** Where side rays start: outside any racquet. */
const OUTSIDE = 0.2;
/** Path steps, about 2 mm of frame either way: degrees on the hoop, metres up the side. */
const STEP_DEG = 1;
const STEP_M = 0.002;
const WIDTH = 0.00635;
const LAYER = 0.0002;
/** Shorter than this is no piece: it would have no direction to lie in. */
const MIN_MM = 1;
/** The hoop (bridge included) reaches this far below the lowest main's end. */
const HOOP_DEPTH = Math.max(...Object.values(HOOP_RADIAL));

interface Hit { point: Vector3; normal: Vector3 }
type Cast = (s: number) => Hit | null;

// Rays are cast against stand-ins sharing the geometry, so the model's materials and matrices stay as
// they are. The material is never drawn, so there is nothing to dispose.
const anySide = new MeshBasicMaterial({ side: DoubleSide });

function standIns(root: Object3D, names: string[]): Mesh[] {
  return names.flatMap((name) => {
    const part = root.getObjectByName(name) as Mesh | undefined;
    if (!part?.isMesh) return [];
    const copy = new Mesh(part.geometry, anySide);
    copy.matrixWorld.compose(part.position, part.quaternion, part.scale); // racquet space, wherever the model stands
    return [copy];
  });
}

function caster(parts: Mesh[]): (origin: Vector3, direction: Vector3) => Hit | null {
  const ray = new Raycaster();
  return (origin, direction) => {
    ray.set(origin, direction);
    const hit = ray.intersectObjects(parts, false)[0];
    if (!hit?.face) return null;
    // The flat face's normal, not the smoothed one: a ribbon flush with the face never dips into it.
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(direction) > 0) normal.negate();
    return { point: hit.point, normal };
  };
}

/** Walk `half` metres of surface each way from `start`; null when the surface runs out, or past `limit` from the start. */
function walk(cast: Cast, start: number, step: number, half: number, limit: number): Hit[] | null {
  const middle = cast(start);
  if (!middle) return null;
  const arm = (dir: number): Hit[] | null => {
    const out: Hit[] = [];
    let prev = middle;
    let s = start;
    for (let left = half; left > 1e-6; ) {
      let next = cast(s + dir * step);
      if (!next) return null;
      const d = next.point.distanceTo(prev.point);
      // The last step is cut short so the piece is as long as asked.
      s += dir * step * Math.min(1, left / d);
      if (d > left) next = cast(s);
      if (!next || Math.abs(s - start) > limit) return null;
      out.push(next);
      prev = next;
      left -= d;
    }
    return out;
  };
  const back = arm(-1);
  const on = back && arm(1);
  return on && [...back.reverse(), middle, ...on];
}

const lowestMain = (beds: Beds): number => Math.min(...beds.mains.lines.map((l) => l.from));
const centreY = (beds: Beds): number => (lowestMain(beds) + Math.max(...beds.mains.lines.map((l) => l.to))) / 2;
const turn = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** The last whole mm up the side: above it is the hoop, whose outer side is bumper and grommets. */
const sideEndMm = (beds: Beds): number => Math.floor((lowestMain(beds) - HOOP_DEPTH) * 1000);

type Place = Pick<TapePiece, 'zone' | 'at'>;

/** Where a piece touches the model, end to end. `z` is the hoop's face: side rays run through the middle. */
function lay(root: Object3D, beds: Beds, { zone, at }: Place, half: number, z: number): Hit[] | null {
  if (zone === 'h') {
    const cast = caster(standIns(root, ['frame']));
    const y = centreY(beds);
    const from: Cast = (deg) => {
      const a = (deg * Math.PI) / 180;
      return cast(new Vector3(0, y, z), new Vector3(Math.sin(a), Math.cos(a), 0));
    };
    return walk(from, at, STEP_DEG, half, 180); // half a turn each way is the whole hoop: no piece laps itself
  }
  if (at > sideEndMm(beds)) return null;
  const cast = caster(standIns(root, ['frame', 'collar', 'grip']));
  const side = zone === 'r' ? 1 : -1;
  return walk((y) => cast(new Vector3(side * OUTSIDE, y, 0), new Vector3(-side, 0, 0)), at / 1000, STEP_M, half, Infinity);
}

function mirrorOf({ zone, at }: TapePiece): Place {
  return zone === 'h' ? { zone, at: turn(-at) } : { zone: zone === 'l' ? 'r' : 'l', at };
}

/** Centre of mass of a path of even weight: each stretch counts by its length. */
function centroidOf(path: Vector3[]): Vector3 {
  const sum = new Vector3();
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = path[i].distanceTo(path[i - 1]);
    sum.addScaledVector(path[i], d / 2).addScaledVector(path[i - 1], d / 2);
    total += d;
  }
  return sum.divideScalar(total);
}

/** Lay a piece on a loaded model: one path, or one each side when mirrored. [] when it cannot lie there, both sides or neither. */
export function placeTape(root: Object3D, beds: Beds, piece: TapePiece): PlacedTape[] {
  const { zone, at, lengthMm, layers } = piece;
  if (![at, lengthMm, layers].every(Number.isFinite) || lengthMm < MIN_MM || layers < 1) return [];
  const places: Place[] = [piece];
  if (piece.mirrored) {
    const other = mirrorOf(piece);
    if (other.zone !== zone || other.at !== turn(at)) places.push(other); // 12 and 6 o'clock mirror onto themselves
  }
  // In front of the strings, or behind them when the front has not room for all of it.
  for (const z of zone === 'h' ? [BESIDE_STRINGS, -BESIDE_STRINGS] : [0]) {
    const laid = places.map((place) => lay(root, beds, place, lengthMm / 2000, z));
    if (laid.some((hits) => !hits)) continue;
    return (laid as Hit[][]).map((hits) => {
      const path = hits.map((h) => h.point);
      return { piece, path, normals: hits.map((h) => h.normal), centroid: centroidOf(path) };
    });
  }
  return [];
}

/**
 * What a click on the frame, collar or grip means, in whole degrees or mm. Any side of the hoop is the
 * hoop. `root` is not needed, the beds say where the hoop is; it is here so that both calls about a
 * model take the model, and a better reading of the surface can come without changing the callers.
 */
export function tapeAt(_root: Object3D, beds: Beds, hit: Vector3): Pick<TapePiece, 'zone' | 'at'> {
  const mm = Math.round(hit.y * 1000); // rounded first, so the place given is one placeTape takes
  if (mm > sideEndMm(beds)) return { zone: 'h', at: Math.round(turn((Math.atan2(hit.x, hit.y - centreY(beds)) * 180) / Math.PI)) % 360 };
  return { zone: hit.x < 0 ? 'l' : 'r', at: mm };
}

/** The piece as a thin strip standing on its path: top, both long edges and both ends, flat shaded. */
export function tapeGeometry(t: PlacedTape): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const high = LAYER * t.piece.layers;
  const rings = t.path.map((p, i) => {
    const up = t.normals[i];
    const ahead = t.path[Math.min(i + 1, t.path.length - 1)].clone().sub(t.path[Math.max(i - 1, 0)]).normalize();
    const left = ahead.clone().cross(up).normalize(); // (ahead, up, left) is right-handed
    const at = (w: number, h: number) => p.clone().addScaledVector(left, (w * WIDTH) / 2).addScaledVector(up, h * high);
    return { up, left, right: left.clone().negate(), lt: at(1, 1), lb: at(1, 0), rt: at(-1, 1), rb: at(-1, 0) };
  });
  type Ring = (typeof rings)[number];
  const vertex = (p: Vector3, n: Vector3) => {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
  };
  /** Faces (b - a) x ahead. */
  const strip = (a: 'rt' | 'lt' | 'rb', b: 'lt' | 'lb' | 'rt', normal: 'up' | 'left' | 'right') => {
    const base = positions.length / 3;
    for (const r of rings) {
      vertex(r[a], r[normal]);
      vertex(r[b], r[normal]);
    }
    for (let i = 0; i + 1 < rings.length; i++) {
      const k = base + 2 * i;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  };
  strip('rt', 'lt', 'up');
  strip('lt', 'lb', 'left');
  strip('rb', 'rt', 'right');
  /** left x up looks back along the path, so the far end turns it round. */
  const end = (r: Ring, corners: Vector3[], facing: 1 | -1) => {
    const base = positions.length / 3;
    for (const c of corners) vertex(c, r.left.clone().cross(r.up).multiplyScalar(facing));
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const first = rings[0], last = rings[rings.length - 1];
  end(first, [first.rb, first.lb, first.lt, first.rt], 1);
  end(last, [last.rt, last.lt, last.lb, last.rb], -1);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  return g;
}
