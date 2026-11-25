import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vector3, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Catalog } from '../src/catalog';

const assets = join(import.meta.dir, '../assets');
export const catalog: Catalog = JSON.parse(readFileSync(join(assets, 'catalog.json'), 'utf8'));
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** A published model, loaded afresh: the same scene a viewer gets. */
export async function load(path: string): Promise<Object3D> {
  const b = readFileSync(join(assets, path));
  return (await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '')).scene;
}

export const part = (root: Object3D, name: string): Mesh => root.getObjectByName(name) as Mesh;

/** A part's vertices in racquet space. */
export function points(mesh: Mesh): Vector3[] {
  mesh.updateMatrix();
  const pos = mesh.geometry.getAttribute('position');
  return Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix));
}
