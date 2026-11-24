// The lit niche behind the detail view's racquet: a plain warm backdrop that curves from floor to
// wall, a pool of light on it, and the racquet's own soft shadow. It is drawn first, writes no
// depth, and stays opposite the camera, so it can never get in front of the racquet.
//
// Three layers, each over the last: a lit ground that fills the view, the wall, and the floor with
// its sweep. From the side they read as one surface. As the camera sinks to the floor's level the
// floor dissolves into the wall behind it, and looking up from far below the wall dissolves too, so
// the racquet hangs in the same pool of light and its butt cap can be seen.
//
// The shadow is the racquet's silhouette seen from the key light, blurred twice (a little and a
// lot). Each point of the backdrop mixes the two by how far behind the racquet it lies, so the
// shadow is crisp at the butt cap and melts as it climbs the wall.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  type PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  ZeroFactor,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { KEY_DIRECTION } from './studio';
import type { Presence } from './view-math';

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

/** A strip across the niche through `profile` points; `along` is the distance from under the
 *  racquet, so light falls across the bend, and from floor to wall, without a seam. */
function strip(profile: Array<[z: number, y: number]>, from: number): BufferGeometry {
  const position: number[] = [];
  const along: number[] = [];
  const index: number[] = [];
  let s = from;
  profile.forEach(([z, y], i) => {
    if (i) s += Math.hypot(z - profile[i - 1][0], y - profile[i - 1][1]);
    position.push(-HALF_WIDTH, y, z, HALF_WIDTH, y, z);
    along.push(s, s);
    const k = i * 2;
    if (i) index.push(k - 2, k - 1, k, k, k - 1, k + 1);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
  g.setAttribute('along', new BufferAttribute(new Float32Array(along), 1));
  g.setIndex(index);
  return g;
}

/** Where the sweep begins and ends, measured along the surface from under the racquet. */
const BEND = WALL - SWEEP;
const BEND_END = BEND + (SWEEP * Math.PI) / 2;

function floorStrip(): BufferGeometry {
  const profile: Array<[number, number]> = [[FLOOR_FRONT, 0], [1, 0], [0.3, 0], [0, 0]];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    profile.push([-BEND - Math.sin(a) * SWEEP, SWEEP - Math.cos(a) * SWEEP]);
  }
  return strip(profile, -FLOOR_FRONT);
}

/** The wall runs on below the floor, for when the floor is not there. */
function wallStrip(): BufferGeometry {
  return strip([[-WALL, -WALL_TOP], [-WALL, 0], [-WALL, SWEEP], [-WALL, 0.7], [-WALL, 1.4], [-WALL, WALL_TOP]], BEND_END - SWEEP - WALL_TOP);
}

const surfaceVertex = /* glsl */ `
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

const groundVertex = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

const shared = /* glsl */ `
  uniform vec3 shade;
  uniform vec3 pool;
  uniform vec2 resolution;
  uniform float reveal;
  uniform float asData;

  float blob(vec2 p, vec2 size) { p /= size; return exp(-dot(p, p)); }

  // Two overlapping pools: the wide wash of the key, and a smaller warm heart behind the head.
  // 'p' is metres right of and above the racquet's middle.
  float wash(vec2 p) {
    return 0.62 * blob(p + vec2(0.10, -0.01), vec2(0.95, 0.85))
         + 0.38 * blob(p + vec2(0.04, -0.19), vec2(0.42, 0.46));
  }

  // The niche's own edges: a soft fall-off at the lintel and the sides.
  float edges() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 e = vec2(min(uv.x, 1.0 - uv.x) * resolution.x / resolution.y, 1.0 - uv.y);
    return 1.0 - 0.07 * exp(-e.y / 0.10) - 0.05 * exp(-e.x / 0.09);
  }
  vec3 lit(float light) {
    return mix(shade, pool, clamp(light, 0.0, 1.0)) * edges();
  }
  // For the print looks: how lit (0 to 1) and how shadowed (0 to 1) this point is, not its colour.
  vec3 data(float light, float shadow) {
    return vec3(clamp(light, 0.0, 1.0) * edges(), clamp(shadow / 0.62, 0.0, 1.0), 0.0);
  }

  // A light gradient this wide bands in 8 bits without a little noise.
  vec3 dithered(vec3 c) {
    return c + (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  }`;

const groundFragment = /* glsl */ `
  ${shared}
  uniform vec2 centre;
  uniform vec2 metres;
  varying vec2 vNdc;
  void main() {
    float light = wash((vNdc - centre) * metres);
    if (asData > 0.5) { gl_FragColor = vec4(data(light, 0.0), 1.0); return; }
    gl_FragColor = vec4(lit(light), 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(dithered(gl_FragColor.rgb), 1.0) * reveal;
  }`;

const surfaceFragment = /* glsl */ `
  ${shared}
  uniform sampler2D tNear;
  uniform sampler2D tFar;
  uniform vec3 shadowTint;
  uniform float presence;
  uniform float floorPresence;
  varying vec3 vLocal;
  varying float vAlong;
  varying vec2 vShadow;

  void main() {
    if (presence <= 0.0) discard;
    float light = wash(vec2(vLocal.x, vAlong - ${(BEND_END - SWEEP + 0.34).toFixed(4)}));
    // Light reaching the floor around the butt cap, so it stands in the pool, not at its edge.
    light += 0.30 * blob(vec2(vLocal.x, vAlong + 0.12), vec2(0.75, 0.62));
    // Where floor turns into wall, each shades the other a little.
    light -= 0.16 * floorPresence * exp(-pow((vAlong - ${((BEND + BEND_END) / 2).toFixed(4)}) / 0.16, 2.0));
    vec3 c = lit(light);

    float soft = smoothstep(0.0, 0.26, max(0.0, -vLocal.z));
    float s = mix(texture2D(tNear, vShadow).r, texture2D(tFar, vShadow).r, soft);
    vec2 inside = step(vec2(0.0), vShadow) * step(vShadow, vec2(1.0));
    s *= inside.x * inside.y * mix(0.62, 0.5, soft);
    // Contact: the dark little halo where the cap meets the floor.
    float onFloor = step(abs(vLocal.y), 0.002);
    s = max(s, 0.55 * blob(vLocal.xz, vec2(0.034, 0.030)) * onFloor);
    s = max(s, 0.22 * blob(vLocal.xz, vec2(0.11, 0.085)) * onFloor);
    if (asData > 0.5) { gl_FragColor = vec4(data(light, s) * presence, presence); return; }
    c = mix(c, c * shadowTint, s);

    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    // Blended so that layers mix among themselves; 'reveal' then fades the stack as one.
    gl_FragColor = vec4(dithered(gl_FragColor.rgb) * presence * reveal, presence);
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
  private readonly uniforms: Record<string, { value: unknown }>;
  /** Holds the layers alone while they are drawn as data. */
  private readonly apart = new Scene();
  private readonly dataTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
  private readonly wallPresence = { value: 1 };
  private readonly floorPresence = { value: 1 };
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
    this.uniforms = {
      tNear: { value: this.near[0].texture },
      tFar: { value: this.far[0].texture },
      lightMatrix: { value: new Matrix4() },
      shade: { value: new Color(0xc3b5a2) },
      pool: { value: new Color(0xe9dece) },
      shadowTint: { value: new Color(0x8a7460) },
      resolution: { value: new Vector2(1, 1) },
      reveal: { value: 1 },
      asData: { value: 0 },
      centre: { value: new Vector2() },
      metres: { value: new Vector2(1, 1) },
    };
    const flat = { side: DoubleSide, depthTest: false, depthWrite: false, toneMapped: false };
    const surface = (presence: { value: number }) => new ShaderMaterial({
      ...flat,
      uniforms: { ...this.uniforms, presence, floorPresence: this.floorPresence },
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    });
    const ground = new ShaderMaterial({ ...flat, uniforms: this.uniforms, vertexShader: groundVertex, fragmentShader: groundFragment, blending: NoBlending });
    const layers: Array<[BufferGeometry, ShaderMaterial]> = [
      [new PlaneGeometry(2, 2), ground],
      [wallStrip(), surface(this.wallPresence)],
      [floorStrip(), surface(this.floorPresence)],
    ];
    layers.forEach(([geometry, material], i) => {
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = i - layers.length; // before the racquet, in this order
      mesh.frustumCulled = false;
      this.node.add(mesh);
    });
    const plane = new Mesh(new PlaneGeometry(2, 2), this.blur);
    plane.frustumCulled = false;
    this.quad.add(plane);
  }

  /** 0: only the racquet is drawn, 1: the alcove is fully lit. */
  set reveal(v: number) {
    this.uniforms.reveal.value = v;
  }

  /**
   * Turn to face the camera and take the racquet's shadow again from there. `lit` is the scene the
   * racquet stands in; everything else in it is hidden while the silhouette is drawn.
   */
  update(renderer: WebGLRenderer, lit: Scene, camera: PerspectiveCamera, yaw: number, floor: number, presence: Presence): void {
    this.node.rotation.y = yaw;
    this.node.position.y = floor;
    this.floorPresence.value = presence.floor;
    this.wallPresence.value = presence.wall;
    renderer.getDrawingBufferSize(this.uniforms.resolution.value as Vector2);
    // The ground's pool hangs behind the racquet on screen, at the size the wall's would have.
    const reach = Math.max(0.05, camera.position.distanceTo(CENTRE)) * Math.tan(MathUtils.degToRad(camera.fov) / 2);
    camera.updateMatrixWorld();
    const at = CENTRE.clone().project(camera);
    (this.uniforms.centre.value as Vector2).set(at.x, at.y);
    (this.uniforms.metres.value as Vector2).set(reach * camera.aspect, reach);
    this.light.position.copy(KEY_DIRECTION).multiplyScalar(2).applyAxisAngle(this.node.up, yaw).add(CENTRE);
    this.light.lookAt(CENTRE);
    this.light.updateMatrixWorld();
    (this.uniforms.lightMatrix.value as Matrix4).multiplyMatrices(this.light.projectionMatrix, this.light.matrixWorldInverse);

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

  /** The alcove as light and shadow amounts (red and green), for a look to redraw its own way. */
  asData(renderer: WebGLRenderer, camera: PerspectiveCamera): Texture {
    const size = this.uniforms.resolution.value as Vector2;
    // Both are smooth, so half size is plenty.
    const w = Math.max(1, Math.ceil(size.x / 2));
    const h = Math.max(1, Math.ceil(size.y / 2));
    if (this.dataTarget.width !== w || this.dataTarget.height !== h) this.dataTarget.setSize(w, h);
    size.set(w, h);
    this.uniforms.asData.value = 1;
    this.apart.add(this.node);
    renderer.setRenderTarget(this.dataTarget);
    renderer.render(this.apart, camera);
    renderer.setRenderTarget(null);
    this.node.removeFromParent();
    this.uniforms.asData.value = 0;
    return this.dataTarget.texture;
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
