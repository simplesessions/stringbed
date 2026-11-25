import { BufferGeometry, Float32BufferAttribute, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import type { Finish, HexColor } from './core/spec';
import { ROUGHNESS } from './styles/finish';

/** One kind of string: `sides` 0 is round, otherwise 3 or more flat faces. */
export interface Strand { color: HexColor; finish: Finish; gaugeMm: number; sides: number }
/** One string, metres. Mains: at = x, from/to = y. Crosses: at = y, from/to = x. */
export interface Line { at: number; from: number; to: number }
export interface Bed { lines: Line[]; z: number }
export interface Beds { mains: Bed; crosses: Bed }

/** A string mesh as it came from the file: shared by every clone of the model, so never disposed here. */
interface Original { geometry: BufferGeometry; material: Mesh['material']; position: Vector3; quaternion: Quaternion; scale: Vector3 }
/** What each geometry made here stands in for. By geometry, so a clone of a restrung model knows its originals too. */
const standsFor = new WeakMap<BufferGeometry, Original>();
/** How to undo a restrung mesh, whichever root it was reached by. */
const undoOf = new WeakMap<Object3D, () => void>();

/** Strings closer together than this, metres, are one string (its own two edges are a gauge apart). */
const STRING_GAP = 0.002;
const ROUND_SIDES = 8;

function stringMeshes(root: Object3D): { mains: Mesh; crosses: Mesh } | null {
  const mains = root.getObjectByName('strings_mains') as Mesh | undefined;
  const crosses = root.getObjectByName('strings_crosses') as Mesh | undefined;
  return mains?.isMesh && crosses?.isMesh ? { mains, crosses } : null;
}

function original({ geometry, material, position, quaternion, scale }: Mesh): Original {
  return standsFor.get(geometry) ?? { geometry, material, position: position.clone(), quaternion: quaternion.clone(), scale: scale.clone() };
}

/** Published strings are straight and axis-aligned, so each is a clump of vertices across its axis. */
function readBed(o: Original, across: 'x' | 'y', along: 'x' | 'y'): Bed {
  const pos = o.geometry.getAttribute('position');
  // The file's numbers are quantised: the node's scale and offset turn them back into metres.
  const toRacquet = new Matrix4().compose(o.position, o.quaternion, o.scale);
  const pts = Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i).applyMatrix4(toRacquet));
  pts.sort((a, b) => a[across] - b[across]);
  const lines: Line[] = [];
  let start = 0;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    lo = Math.min(lo, pts[i].z);
    hi = Math.max(hi, pts[i].z);
    if (i + 1 < pts.length && pts[i + 1][across] - pts[i][across] <= STRING_GAP) continue;
    const ends = pts.slice(start, i + 1).map((p) => p[along]);
    lines.push({ at: (pts[start][across] + pts[i][across]) / 2, from: Math.min(...ends), to: Math.max(...ends) });
    start = i + 1;
  }
  return { lines, z: (lo + hi) / 2 };
}

/** Where a loaded model's strings run, always as the file has them. Null without both string parts. */
export function bedLines(root: Object3D): Beds | null {
  const m = stringMeshes(root);
  return m && { mains: readBed(original(m.mains), 'x', 'y'), crosses: readBed(original(m.crosses), 'y', 'x') };
}

/** A bed strung with `strand`, in racquet space. Open ends, as in the published files: the frame hides them. */
export function strandGeometry(bed: Bed, axis: 'mains' | 'crosses', strand: Strand): BufferGeometry {
  const r = strand.gaugeMm / 2000;
  const round = strand.sides < 3;
  const n = round ? ROUND_SIDES : strand.sides;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  // Angles run from +Z towards p, where (Z, p, string) is right-handed: p is +X on a main, -Y on a cross.
  const vertex = (l: Line, s: number, phi: number, normal: number) => {
    const p = r * Math.sin(phi);
    const z = bed.z + r * Math.cos(phi);
    if (axis === 'mains') {
      positions.push(l.at + p, s, z);
      normals.push(Math.sin(normal), 0, Math.cos(normal));
    } else {
      positions.push(s, l.at - p, z);
      normals.push(0, -Math.sin(normal), Math.cos(normal));
    }
  };
  const step = (2 * Math.PI) / n;
  for (const l of bed.lines) {
    const base = positions.length / 3;
    if (round) {
      for (let k = 0; k < n; k++) for (const s of [l.from, l.to]) vertex(l, s, k * step, k * step);
      for (let k = 0; k < n; k++) {
        const a = base + 2 * k, b = base + 2 * ((k + 1) % n);
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    } else {
      // Every face has its own corners, so it shades flat. Face 0 looks along +Z.
      for (let k = 0; k < n; k++) {
        const a = base + 4 * k;
        for (const side of [-0.5, 0.5]) for (const s of [l.from, l.to]) vertex(l, s, (k + side) * step, k * step);
        indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  return g;
}

/**
 * String a loaded model with something else, in place. Returns an undo, safe to call twice, or null
 * when the model has no strings. Restringing again undoes the earlier one first.
 */
export function restring(root: Object3D, mains: Strand, crosses: Strand = mains): (() => void) | null {
  const meshes = stringMeshes(root);
  if (!meshes) return null;
  for (const mesh of [meshes.mains, meshes.crosses]) undoOf.get(mesh)?.();
  const beds = bedLines(root)!;

  const dress = (mesh: Mesh, axis: 'mains' | 'crosses', strand: Strand): (() => void) => {
    const from = original(mesh);
    const geometry = strandGeometry(beds[axis], axis, strand);
    // Never the original recoloured: clones and thumbnails share it.
    const material = new MeshStandardMaterial({ name: mesh.name, color: strand.color, roughness: ROUGHNESS[strand.finish], metalness: 0 });
    standsFor.set(geometry, from);
    mesh.geometry = geometry;
    mesh.material = material;
    place(mesh, new Vector3(), new Quaternion(), new Vector3(1, 1, 1)); // the original transform is the file's quantisation, and the new geometry is in metres
    return () => {
      mesh.geometry = from.geometry;
      mesh.material = from.material;
      place(mesh, from.position, from.quaternion, from.scale);
      geometry.dispose();
      material.dispose();
    };
  };
  const undos = [dress(meshes.mains, 'mains', mains), dress(meshes.crosses, 'crosses', crosses)];
  const undo = () => {
    if (undoOf.get(meshes.mains) !== undo) return; // already undone, or strung over
    for (const mesh of [meshes.mains, meshes.crosses]) undoOf.delete(mesh);
    for (const u of undos) u();
  };
  for (const mesh of [meshes.mains, meshes.crosses]) undoOf.set(mesh, undo);
  return undo;
}

function place(mesh: Mesh, position: Vector3, quaternion: Quaternion, scale: Vector3): void {
  mesh.position.copy(position);
  mesh.quaternion.copy(quaternion);
  mesh.scale.copy(scale);
  mesh.updateMatrix();
}
