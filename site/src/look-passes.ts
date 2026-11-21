// Alternative render looks, drawn with the renderer that already exists (no new WebGL
// context). Realistic is a plain render. Pixel renders to a small target and blows it up
// with nearest-neighbour cells. Line renders view normals plus coverage and a flat, unlit
// colour pass, then fills each part with its own colour in two tones and inks the edges.
// Materials are never changed: line swaps mesh materials for one draw and puts them back,
// because clones share materials with the cached source.
import {
  DepthTexture,
  DoubleSide,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import type { Look } from './look';

/** Sizes in CSS px; multiplied by the device pixel scale at draw time. */
export interface LookScale {
  /** Pixel look: the side of one cell. */
  cell: number;
  /** Line look: half-width of the outer silhouette. */
  outline: number;
}

/** The design system's ink, oklch(0.23 0.01 75), as sRGB 0..1 (written to the canvas as is). */
const INK = new Vector3(0x20 / 255, 0x1c / 255, 0x18 / 255);
const LEVELS = 10; // pixel look: colour levels per channel

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

const pixelFragment = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tStrings;
  uniform vec2 resolution;
  uniform float cell;
  uniform float levels;
  void main() {
    // Every canvas pixel in a cell reads the same low-res texel: crisp squares.
    vec2 base = floor(gl_FragCoord.xy / cell) * cell;
    vec2 uv = clamp((base + 0.5 * cell) / resolution, 0.0, 1.0);
    vec4 c = texture2D(tColor, uv);
    float alpha = 1.0;
    if (c.a < 0.5) {
      // Strings are thinner than a cell, so they are drawn separately at 4x and averaged per
      // cell: the string bed becomes an even, light fill instead of a few stray bars.
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
        sum += texture2D(tStrings, clamp((base + (vec2(float(i), float(j)) + 0.5) * cell * 0.25) / resolution, 0.0, 1.0));
      }
      sum /= 16.0;
      if (sum.a < 0.04) { gl_FragColor = vec4(0.0); return; }
      c = vec4(sum.rgb / sum.a, 1.0);
      alpha = 0.4;
    }
    gl_FragColor = vec4(c.rgb / c.a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + 0.5) / levels;
    gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha);
  }`;

const gbufferVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const gbufferFragment = /* glsl */ `
  uniform float marker;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    gl_FragColor = vec4(n * 0.5 + 0.5, marker);
  }`;

// Coverage alpha in the G-buffer: 1 = body (frame, grip, ...), 0.5 = strings, 0 = empty.
const lineFragment = /* glsl */ `
  #include <packing>
  uniform sampler2D tG;
  uniform sampler2D tDepth;
  uniform vec2 resolution;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float perspective;
  uniform float outline;
  uniform float crease;
  uniform float depthStep;
  uniform vec3 ink;
  uniform sampler2D tFill;
  varying vec2 vUv;

  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  float viewZ(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return perspective > 0.5 ? perspectiveDepthToViewZ(d, cameraNear, cameraFar) : orthographicDepthToViewZ(d, cameraNear, cameraFar);
  }
  float isBody(float a) { return step(0.75, a); }
  float isString(float a) { return step(0.25, a) * (1.0 - step(0.75, a)); }

  void main() {
    vec2 px = 1.0 / resolution;
    vec4 g0 = texture2D(tG, vUv);
    float b0 = isBody(g0.a);
    float z0 = viewZ(vUv);
    vec3 n0 = g0.rgb * 2.0 - 1.0;

    // Outer silhouette and occluding contours: body against not-body, or a depth jump.
    // Sampled on two rings so the line is solid and about 2 * outline wide.
    float hits = 0.0;
    for (int i = 0; i < 8; i++) {
      float an = float(i) * 0.7853982;
      vec2 dir = vec2(cos(an), sin(an)) * px;
      for (int k = 1; k <= 2; k++) {
        vec2 uv = vUv + dir * outline * float(k) * 0.5;
        float b = isBody(texture2D(tG, uv).a);
        float edge = abs(b - b0);
        if (b * b0 > 0.5 && viewZ(uv) - z0 > depthStep) edge = 1.0; // the far side of an occluding edge
        hits += edge;
      }
    }
    float sil = smoothstep(0.0, 3.0, hits);

    // Creases: a turn in the surface normal between direct neighbours, drawn lighter.
    float c = 0.0;
    if (b0 > 0.5) {
      vec2 o[4];
      o[0] = vec2(px.x, 0.0); o[1] = vec2(-px.x, 0.0); o[2] = vec2(0.0, px.y); o[3] = vec2(0.0, -px.y);
      for (int i = 0; i < 4; i++) {
        vec4 g = texture2D(tG, vUv + o[i]);
        if (isBody(g.a) > 0.5) c = max(c, smoothstep(0.18, 0.4, 1.0 - dot(n0, g.rgb * 2.0 - 1.0)));
      }
    }

    // Strings: their own coverage, in a light ink.
    float s = isString(g0.a) * 0.4;
    float a = max(sil, max(c * crease, s));

    // Fill: each part's own flat colour in two tones (lit / shade, split on the view normal),
    // so the drawing keeps the racquet's colourway. Strings get a light wash of theirs.
    vec3 fill = texture2D(tFill, vUv).rgb;
    float tone = mix(0.78, 1.0, smoothstep(0.28, 0.36, n0.z));
    float fa = max(b0, isString(g0.a) * 0.55);
    vec3 base = toSRGB(fill * (b0 > 0.5 ? tone : 1.0));
    // Ink over fill, premultiplied (the canvas is premultiplied alpha).
    gl_FragColor = vec4(ink * a + base * fa * (1.0 - a), a + fa * (1.0 - a));
  }`;

function fullscreen(material: ShaderMaterial): { scene: Scene; material: ShaderMaterial } {
  material.depthTest = false;
  material.depthWrite = false;
  material.blending = NoBlending;
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, material };
}

export class LookPainter {
  private look: Look = 'realistic';
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new Vector2();
  private colorTarget: WebGLRenderTarget | null = null;
  private gTarget: WebGLRenderTarget | null = null;
  private readonly pixel = fullscreen(new ShaderMaterial({
    uniforms: { tColor: { value: null }, tStrings: { value: null }, resolution: { value: new Vector2() }, cell: { value: 4 }, levels: { value: LEVELS } },
    vertexShader: fullscreenVertex,
    fragmentShader: pixelFragment,
  }));
  private readonly line = fullscreen(new ShaderMaterial({
    uniforms: {
      tG: { value: null },
      tDepth: { value: null },
      resolution: { value: new Vector2() },
      cameraNear: { value: 0.01 },
      cameraFar: { value: 10 },
      perspective: { value: 0 },
      outline: { value: 2 },
      crease: { value: 0.75 },
      depthStep: { value: 0.015 },
      ink: { value: INK },
      tFill: { value: null },
    },
    vertexShader: fullscreenVertex,
    fragmentShader: lineFragment,
    toneMapped: false,
  }));
  private readonly bodyMaterial = new ShaderMaterial({ uniforms: { marker: { value: 1 } }, vertexShader: gbufferVertex, fragmentShader: gbufferFragment, side: DoubleSide, blending: NoBlending, toneMapped: false });
  private readonly stringMaterial = new ShaderMaterial({ uniforms: { marker: { value: 0.5 } }, vertexShader: gbufferVertex, fragmentShader: gbufferFragment, side: DoubleSide, blending: NoBlending, toneMapped: false });
  private readonly swapped: Array<[Mesh, Material | Material[]]> = [];
  private fillTarget: WebGLRenderTarget | null = null;
  private stringTarget: WebGLRenderTarget | null = null;
  /** Unlit copies of the models' materials (same colour, same vertex colours), made once each. */
  private readonly flat = new WeakMap<Material, MeshBasicMaterial>();

  private flatFor(material: Material): MeshBasicMaterial {
    let f = this.flat.get(material);
    if (!f) {
      const m = material as MeshStandardMaterial;
      f = new MeshBasicMaterial({ color: m.color, vertexColors: m.vertexColors, side: DoubleSide, toneMapped: false });
      this.flat.set(material, f);
    }
    return f;
  }

  constructor(private readonly renderer: WebGLRenderer) {}

  setLook(look: Look): void {
    this.look = look;
  }

  /** Draw `scene` to the canvas in the current look. `scale` is device px per CSS px. */
  render(scene: Scene, camera: Camera, scale: number, sizes: LookScale): void {
    const r = this.renderer;
    if (this.look === 'realistic') {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.getDrawingBufferSize(this.size);
    const w = this.size.x;
    const h = this.size.y;
    if (w === 0 || h === 0) return;
    if (this.look === 'pixel') this.renderPixel(scene, camera, w, h, Math.max(1, Math.round(sizes.cell * scale)));
    else this.renderLine(scene, camera, w, h, scale, sizes);
  }

  private renderPixel(scene: Scene, camera: Camera, w: number, h: number, cell: number) {
    const r = this.renderer;
    const lw = Math.ceil(w / cell);
    const lh = Math.ceil(h / cell);
    // Half float keeps highlights above 1 so the blit's tone mapping matches Realistic.
    this.colorTarget ??= new WebGLRenderTarget(lw, lh, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true });
    const t = this.colorTarget;
    if (t.width !== lw || t.height !== lh) t.setSize(lw, lh);
    // Pass 1: everything but the strings at cell resolution. Pass 2: only the strings at 4x.
    const strings: Object3D[] = [];
    const others: Object3D[] = [];
    scene.traverse((o: Object3D) => {
      if ((o as Mesh).isMesh && o.visible) (o.name.startsWith('strings') ? strings : others).push(o);
    });
    for (const o of strings) o.visible = false;
    r.setRenderTarget(t);
    r.render(scene, camera);
    for (const o of strings) o.visible = true;
    for (const o of others) o.visible = false;
    this.stringTarget ??= new WebGLRenderTarget(lw * 4, lh * 4, { type: HalfFloatType, depthBuffer: true });
    const st = this.stringTarget;
    if (st.width !== lw * 4 || st.height !== lh * 4) st.setSize(lw * 4, lh * 4);
    r.setRenderTarget(st);
    r.render(scene, camera);
    for (const o of others) o.visible = true;
    r.setRenderTarget(null);
    const u = this.pixel.material.uniforms;
    u.tColor.value = t.texture;
    u.tStrings.value = st.texture;
    u.resolution.value.set(w, h);
    u.cell.value = cell;
    r.render(this.pixel.scene, this.quadCamera);
  }

  private renderLine(scene: Scene, camera: Camera, w: number, h: number, scale: number, sizes: LookScale) {
    const r = this.renderer;
    if (!this.gTarget) {
      this.gTarget = new WebGLRenderTarget(w, h, { minFilter: NearestFilter, magFilter: NearestFilter, depthTexture: new DepthTexture(w, h) });
      this.gTarget.depthTexture!.minFilter = NearestFilter;
      this.gTarget.depthTexture!.magFilter = NearestFilter;
    }
    const t = this.gTarget;
    if (t.width !== w || t.height !== h) t.setSize(w, h);

    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      this.swapped.push([m, m.material]);
      m.material = o.name.startsWith('strings') ? this.stringMaterial : this.bodyMaterial;
    });
    r.setRenderTarget(t);
    r.render(scene, camera);
    r.setRenderTarget(null);
    for (const [m, material] of this.swapped) m.material = material;
    this.swapped.length = 0;

    // Flat colour pass: the same scene unlit, in linear colour (converted in the line shader).
    this.fillTarget ??= new WebGLRenderTarget(w, h, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true });
    const f = this.fillTarget;
    if (f.width !== w || f.height !== h) f.setSize(w, h);
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      this.swapped.push([m, m.material]);
      m.material = this.flatFor(m.material);
    });
    r.setRenderTarget(f);
    r.render(scene, camera);
    r.setRenderTarget(null);
    for (const [m, material] of this.swapped) m.material = material;
    this.swapped.length = 0;

    const cam = camera as Camera & { near: number; far: number; isPerspectiveCamera?: boolean };
    const u = this.line.material.uniforms;
    u.tG.value = t.texture;
    u.tDepth.value = t.depthTexture;
    u.tFill.value = f.texture;
    u.resolution.value.set(w, h);
    u.cameraNear.value = cam.near;
    u.cameraFar.value = cam.far;
    u.perspective.value = cam.isPerspectiveCamera ? 1 : 0;
    u.outline.value = Math.max(1, sizes.outline * scale);
    r.render(this.line.scene, this.quadCamera);
  }
}
