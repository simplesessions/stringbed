import * as THREE from 'three';

/** Plain triangle accumulator shared by the handle, string and trim builders. Indexed, deterministic. */
export class RawMesh {
  positions: number[] = [];
  indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(x: number, y: number, z: number): number {
    this.positions.push(x, y, z);
    return this.vertexCount - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  /** Append another mesh (indices are shifted; vertices are not shared). */
  append(other: RawMesh): void {
    const base = this.vertexCount;
    this.positions.push(...other.positions);
    for (const i of other.indices) this.indices.push(i + base);
  }

  /** Mirror across x = 0 and append the mirrored copy, flipping winding so it still faces outward. */
  appendMirrorX(): void {
    const base = this.vertexCount;
    const n = this.positions.length;
    for (let i = 0; i < n; i += 3) this.positions.push(-this.positions[i], this.positions[i + 1], this.positions[i + 2]);
    const m = this.indices.length;
    for (let i = 0; i < m; i += 3) this.indices.push(this.indices[i] + base, this.indices[i + 2] + base, this.indices[i + 1] + base);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return g;
  }
}
