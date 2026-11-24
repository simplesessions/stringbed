// The lit niche behind the detail view's racquet: a plain warm backdrop that curves from floor to
// wall, a pool of light on it, and the racquet's own soft shadow. It is drawn first, writes no
// depth, and stays opposite the camera, so it can never get in front of the racquet.
//
// The shadow is the racquet's silhouette seen from the key light, blurred twice (a little and a
// lot). Each point of the backdrop mixes the two by how far behind the racquet it lies, so the
// shadow is crisp at the butt cap and melts as it climbs the wall.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { KEY_DIRECTION } from './studio';

/** How far behind the racquet the wall stands, and the radius of the sweep up to it, metres. */
const WALL = 0.36;
const SWEEP = 0.2;
const FLOOR_FRONT = 5;
const WALL_TOP = 5;
const HALF_WIDTH = 8;
/** Side of the square the silhouette is taken in: the whole racquet at any turn, plus blur. */
const SHADOW_SPAN = 1.15;
const SHADOW_PX = 512;
const CENTRE = new Vector3(0, 0.34, 0);

/** Floor, sweep and wall as one strip; `along` is the distance from under the racquet, so light
 *  falls across the bend without a seam. */
function sweep(): BufferGeometry {
  const profile: Array<[z: number, y: number]> = [[FLOOR_FRONT, 0], [1, 0], [0.3, 0], [0, 0]];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    profile.push([-(WALL - SWEEP) - Math.sin(a) * SWEEP, SWEEP - Math.cos(a) * SWEEP]);
  }
  profile.push([-WALL, 0.7], [-WALL, 1.4], [-WALL, WALL_TOP]);
  const position: number[] = [];
  const along: number[] = [];
  const index: number[] = [];
  let s = -FLOOR_FRONT;
  profile.forEach(([z, y], i) => {
    if (i) s += Math.hypot(z - profile[i - 1][0], y - profile[i - 1][1]);
    position.push(-HALF_WIDTH, y, z, HALF_WIDTH, y, z);
    along.push(s, s);
    const k = i * 2;
    // Top of the wall first: seen from below, the floor must be drawn over the wall.
    if (i) index.unshift(k - 2, k - 1, k, k, k - 1, k + 1);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
  g.setAttribute('along', new BufferAttribute(new Float32Array(along), 1));
  g.setIndex(index);
  return g;
}

const backdropVertex = /* glsl */ `
  attribute float along;
  uniform mat4 lightMatrix;
  varying vec3 vLocal;
  varying float vAlong;
  varying vec2 vShadow;
  void main() {
    vLocal = position;
    vAlong = along;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vShadow = (lightMatrix * world).xy * 0.5 + 0.5;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const backdropFragment = /* glsl */ `
  uniform sampler2D tNear;
  uniform sampler2D tFar;
  uniform vec3 shade;
  uniform vec3 pool;
  uniform vec3 shadowTint;
  uniform vec2 resolution;
  uniform float reveal;
  uniform float floorY;
  varying vec3 vLocal;
  varying float vAlong;
  varying vec2 vShadow;

  float blob(vec2 p, vec2 size) { p /= size; return exp(-dot(p, p)); }

  void main() {
    // Two overlapping pools: the wide wash of the key, and a smaller warm heart behind the head.
    float light = 0.62 * blob(vec2(vLocal.x + 0.10, vAlong - 0.62), vec2(0.95, 0.85))
                + 0.38 * blob(vec2(vLocal.x + 0.04, vAlong - 0.80), vec2(0.42, 0.46));
    // Light reaching the floor around the butt cap, so it stands in the pool, not at its edge.
    light += 0.30 * blob(vec2(vLocal.x, vAlong + 0.12), vec2(0.75, 0.62));
    // Where floor turns into wall, each shades the other a little.
    light -= 0.16 * exp(-pow((vAlong - ${(WALL - SWEEP + 0.157).toFixed(3)}) / 0.16, 2.0));
    vec3 c = mix(shade, pool, clamp(light, 0.0, 1.0));

    // The niche's own edges: a soft fall-off at the lintel and the sides.
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 e = vec2(min(uv.x, 1.0 - uv.x) * resolution.x / resolution.y, 1.0 - uv.y);
    c *= 1.0 - 0.07 * exp(-e.y / 0.10) - 0.05 * exp(-e.x / 0.09);

    float behind = max(0.0, -vLocal.z);
    float soft = smoothstep(0.0, 0.26, behind);
    float s = mix(texture2D(tNear, vShadow).r, texture2D(tFar, vShadow).r, soft);
    vec2 inside = step(vec2(0.0), vShadow) * step(vShadow, vec2(1.0));
    s *= inside.x * inside.y * mix(0.62, 0.5, soft);
    // Contact: the dark little halo where the cap meets the floor.
    s = max(s, 0.55 * blob(vLocal.xz, vec2(0.034, 0.030)) * step(vLocal.y, 0.002));
    s = max(s, 0.22 * blob(vLocal.xz, vec2(0.11, 0.085)) * step(vLocal.y, 0.002));
    // Seen from under the floor there is nothing for it to fall on.
    s *= smoothstep(-0.06, 0.06, cameraPosition.y - floorY);
    c = mix(c, c * shadowTint, s);

    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    // A light gradient this wide bands in 8 bits without a little noise.
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    gl_FragColor.rgb += (noise - 0.5) / 255.0;
    gl_FragColor *= reveal;
  }`;

const blurVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const blurFragment = /* glsl */ `
  uniform sampler2D tSource;
  uniform vec2 step1;
  varying vec2 vUv;
  void main() {
    float sum = 0.0;
    float weight = 0.0;
    for (int i = -10; i <= 10; i++) {
      float w = exp(-float(i * i) / 50.0);
      sum += texture2D(tSource, vUv + step1 * float(i)).r * w;
      weight += w;
    }
    gl_FragColor = vec4(vec3(sum / weight), 1.0);
  }`;

const target = (px: number, samples = 0) =>
  new WebGLRenderTarget(px, px, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: samples > 0, samples });

export class Alcove {
  readonly node = new Group();
  private readonly backdrop: ShaderMaterial;
  private readonly light = new OrthographicCamera(-SHADOW_SPAN / 2, SHADOW_SPAN / 2, SHADOW_SPAN / 2, -SHADOW_SPAN / 2, 0.1, 4);
  private readonly ink = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, toneMapped: false });
  private readonly silhouette = target(SHADOW_PX, 4);
  private readonly near = [target(SHADOW_PX), target(SHADOW_PX)];
  private readonly far = [target(SHADOW_PX / 2), target(SHADOW_PX / 2)];
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad = new Scene();
  private readonly blur = new ShaderMaterial({
    uniforms: { tSource: { value: null as Texture | null }, step1: { value: new Vector2() } },
    vertexShader: blurVertex,
    fragmentShader: blurFragment,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    toneMapped: false,
  });

  constructor() {
    this.backdrop = new ShaderMaterial({
      uniforms: {
        tNear: { value: this.near[0].texture },
        tFar: { value: this.far[0].texture },
        lightMatrix: { value: new Matrix4() },
        shade: { value: new Color(0xc3b5a2) },
        pool: { value: new Color(0xe9dece) },
        shadowTint: { value: new Color(0x8a7460) },
        resolution: { value: new Vector2(1, 1) },
        reveal: { value: 1 },
        floorY: { value: 0 },
      },
      vertexShader: backdropVertex,
      fragmentShader: backdropFragment,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
      toneMapped: false,
    });
    const mesh = new Mesh(sweep(), this.backdrop);
    mesh.name = 'alcove';
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    this.node.add(mesh);
    const plane = new Mesh(new PlaneGeometry(2, 2), this.blur);
    plane.frustumCulled = false;
    this.quad.add(plane);
  }

  /** 0: only the racquet is drawn, 1: the alcove is fully lit. */
  set reveal(v: number) {
    this.backdrop.uniforms.reveal.value = v;
  }

  /**
   * Turn to face the camera at `yaw` and take the racquet's shadow again from there. `lit` is the
   * scene the racquet stands in; everything else in it is hidden while the silhouette is drawn.
   */
  update(renderer: WebGLRenderer, lit: Scene, yaw: number, floor: number): void {
    this.node.rotation.y = yaw;
    this.node.position.y = floor;
    this.backdrop.uniforms.floorY.value = floor;
    renderer.getDrawingBufferSize(this.backdrop.uniforms.resolution.value as Vector2);
    this.light.position.copy(KEY_DIRECTION).multiplyScalar(2).applyAxisAngle(this.node.up, yaw).add(CENTRE);
    this.light.lookAt(CENTRE);
    this.light.updateMatrixWorld();
    (this.backdrop.uniforms.lightMatrix.value as Matrix4).multiplyMatrices(this.light.projectionMatrix, this.light.matrixWorldInverse);

    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    this.node.visible = false;
    lit.overrideMaterial = this.ink;
    renderer.setRenderTarget(this.silhouette);
    renderer.render(lit, this.light);
    lit.overrideMaterial = null;
    this.node.visible = true;
    this.smear(renderer, this.silhouette.texture, this.near, 0.5);
    this.smear(renderer, this.near[0].texture, this.far, 1.15);
    renderer.setRenderTarget(null);
    renderer.shadowMap.autoUpdate = shadows;
  }

  private smear(renderer: WebGLRenderer, source: Texture, [out, scratch]: WebGLRenderTarget[], spread: number) {
    const px = spread / out.width;
    const u = this.blur.uniforms;
    u.tSource.value = source;
    u.step1.value.set(px, 0);
    renderer.setRenderTarget(scratch);
    renderer.render(this.quad, this.quadCamera);
    u.tSource.value = scratch.texture;
    u.step1.value.set(0, px);
    renderer.setRenderTarget(out);
    renderer.render(this.quad, this.quadCamera);
  }
}
