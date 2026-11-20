import { Document, NodeIO } from '@gltf-transform/core';
import type { Part, RacquetModel } from '../core/build';

export interface PbrMaterial {
  baseColor: [number, number, number]; // linear RGB
  metallic: number;
  roughness: number;
}

const q5 = (v: number) => Math.round(v * 1e5) / 1e5;

function quantised(src: ArrayLike<number>): Float32Array<ArrayBuffer> {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = q5(src[i]);
  return out;
}

/** Write a model to binary glTF: one root node, one node/mesh/material per part, no textures. */
export async function modelToGlb(model: RacquetModel, materialFor: (part: Part) => PbrMaterial): Promise<Uint8Array> {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'stringbed';
  const buffer = doc.createBuffer();
  const scene = doc.createScene(model.spec.id);
  const root = doc.createNode(model.spec.id);
  scene.addChild(root);

  for (const part of model.parts) {
    const g = part.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const mat = materialFor(part);
    const material = doc
      .createMaterial(`mat_${part.name}`)
      .setBaseColorFactor([...mat.baseColor, 1])
      .setMetallicFactor(mat.metallic)
      .setRoughnessFactor(mat.roughness);

    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(quantised(pos.array)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(quantised(nor.array)).setBuffer(buffer));

    if (part.surface.vertexColors) {
      const col = g.getAttribute('color');
      const bytes = new Uint8Array(col.count * 3);
      for (let i = 0; i < col.count; i++) {
        bytes[3 * i] = Math.round(Math.min(1, Math.max(0, col.getX(i))) * 255);
        bytes[3 * i + 1] = Math.round(Math.min(1, Math.max(0, col.getY(i))) * 255);
        bytes[3 * i + 2] = Math.round(Math.min(1, Math.max(0, col.getZ(i))) * 255);
      }
      prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(bytes).setNormalized(true).setBuffer(buffer));
    }

    const idx = g.index;
    if (idx) {
      const arr = pos.count < 65536 ? Uint16Array.from(idx.array) : Uint32Array.from(idx.array);
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(arr).setBuffer(buffer));
    }

    const mesh = doc.createMesh(part.name).addPrimitive(prim);
    root.addChild(doc.createNode(part.name).setMesh(mesh));
  }

  return new NodeIO().writeBinary(doc);
}
