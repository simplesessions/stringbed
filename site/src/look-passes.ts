// Alternative render looks, drawn with the renderer that already exists (no new WebGL
// context). Realistic is a plain render. Pixel renders to a small target and blows it up
// with nearest-neighbour cells. Line renders view normals plus coverage and a flat, unlit
// colour pass, then fills each part with its own colour in two tones and inks the edges.
// Materials are never changed: line and pixel swap mesh materials for one draw and put them back,
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
  type Texture,
  type WebGLRenderer,
} from 'three';
import type { Look } from './look';

/** Sizes in CSS px; multiplied by the device pixel scale at draw time. */
export interface LookScale {
  /** Pixel look: the side of one cell. */
  cell: number;
  /** Line look: half-width of the outer silhouette. */
  outline: number;
  /** Halftone look: dot pitch along the screen. */
  dot: number;
  /** Line look: distance between the strokes of a hatched shadow. */
  hatch: number;
}

/** The alcove behind the racquet, as light and shadow amounts for a look to draw its own way. */
export interface LookStage {
  /** Red: how lit, green: how shadowed, 0 to 1. */
  data: Texture;
  /** 0: racquet only, 1: the alcove is fully there. */
  reveal: number;
}

/** The balance marker is a note about the racquet, not part of it: no look draws it as one, and no light or ray meets it. */
export const MARKER_LAYER = 1;

/** What the alcove is drawn with, as sRGB 0..1 (written to the canvas as is). */
const srgb = (hex: number) => new Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

// Shared by the looks. A look works out its racquet as premultiplied sRGB, then lays it over its
// own drawing of the alcove; with no stage (the thumbnails) only the racquet is left.
const stageChunk = /* glsl */ `
  uniform sampler2D tStage;
  uniform float reveal;
  vec2 stageAt(vec2 uv) { return texture2D(tStage, clamp(uv, 0.0, 1.0)).rg; }
  vec4 over(vec4 racquet, vec3 ground) {
    float show = (1.0 - racquet.a) * reveal;
    return vec4(racquet.rgb + ground * show, racquet.a + show);
  }`;
const stageUniforms = () => ({ tStage: { value: null as Texture | null }, reveal: { value: 0 } });

/** The design system's ink, oklch(0.23 0.01 75), as sRGB 0..1 (written to the canvas as is). */
const INK = new Vector3(0x20 / 255, 0x1c / 255, 0x18 / 255);
const LEVELS = 10; // pixel look: brightness levels

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
  uniform vec3 toneDark;
  uniform vec3 toneLight;
  ${stageChunk}

  // Ordered dither, one threshold a cell.
  float bayer(vec2 i) {
    i = mod(i, 4.0);
    float a = mod(i.x, 2.0) * 2.0 + mod(i.y, 2.0) * 3.0 - mod(i.x, 2.0) * mod(i.y, 2.0) * 4.0;
    vec2 j = floor(i / 2.0);
    float b = j.x * 2.0 + j.y * 3.0 - j.x * j.y * 4.0;
    return (a * 4.0 + b + 0.5) / 16.0;
  }
  // The alcove in a handful of tones, stepped and dithered by the cell.
  vec3 ground() {
    if (reveal <= 0.0) return vec3(0.0);
    vec2 idx = floor(gl_FragCoord.xy / cell);
    vec2 st = stageAt((idx + 0.5) * cell / resolution);
    float v = mix(0.42, 1.0, st.r) * (1.0 - 0.72 * st.g);
    float steps = 7.0;
    v = clamp(floor(v * steps + bayer(idx)) / steps, 0.0, 1.0);
    return mix(toneDark, toneLight, v);
  }
  void main() {
    // Every canvas pixel in a cell reads the same low-res texel: crisp squares.
    vec2 base = floor(gl_FragCoord.xy / cell) * cell;
    vec2 uv = clamp((base + 0.5 * cell) / resolution, 0.0, 1.0);
    vec4 c = texture2D(tColor, uv);
    float alpha = 1.0;
    if (c.a < 0.34) {
      // Strings are thinner than a cell (at thumbnail size thinner than even the 4x pass can
      // always catch), so the bed is found from a 7x7 sample over three cells around this one:
      // wide enough to bridge the gaps, and the frame (thicker than a cell) hides the overreach.
      // It is then drawn the way a sprite would: a faint fill with a crisp line every third cell.
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 7; i++) for (int j = 0; j < 7; j++) {
        vec2 at = base + (vec2(float(i), float(j)) / 6.0 * 3.0 - 1.0) * cell;
        sum += texture2D(tStrings, clamp(at / resolution, 0.0, 1.0));
      }
      sum /= 49.0;
      if (sum.a < 0.01) { gl_FragColor = over(vec4(0.0), ground()); return; }
      c = vec4(sum.rgb / sum.a, 1.0);
      // Drawn unlit, so the bed is one flat colour with no blotches; a little off white, so it is not glaring.
      c.rgb *= 0.85;
      vec2 idx = floor(gl_FragCoord.xy / cell);
      bool line = mod(idx.x, 3.0) < 0.5 || mod(idx.y, 3.0) < 0.5;
      alpha = line ? 0.72 : 0.2;
    }
    gl_FragColor = vec4(c.rgb / c.a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    // Step the brightness, not each channel: a warm white must not break into pink and yellow.
    float peak = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
    gl_FragColor.rgb *= floor(peak * levels + 0.5) / levels / max(peak, 1e-4);
    gl_FragColor = over(vec4(gl_FragColor.rgb * alpha, alpha), ground());
  }`;

// Halftone: a 45-degree dot screen. Each dot takes the mean colour of its cell; its size follows how
// dark that colour is (shadow = big dots, highlight = small) and how much of the cell the racquet
// fills, so thin strings print as an even row of small dots instead of a broken one. On the stage a
// second plate prints the alcove in one warm ink, knocked out where the racquet prints.
const halftoneFragment = /* glsl */ `
  uniform sampler2D tColor;
  uniform vec2 resolution;
  uniform float pitch;
  uniform vec3 paper;
  uniform vec3 groundInk;
  ${stageChunk}
  const float ANGLE = 0.7853982;
  float dotCover(float d, float r) { return r <= 0.0 ? 0.0 : 1.0 - smoothstep(r - 0.75, r + 0.75, d); }
  void main() {
    mat2 rot = mat2(cos(ANGLE), -sin(ANGLE), sin(ANGLE), cos(ANGLE));
    vec2 p = rot * gl_FragCoord.xy;
    vec2 cellCentre = (floor(p / pitch) + 0.5) * pitch;
    float d = length(p - cellCentre);
    vec2 centre = transpose(rot) * cellCentre;

    vec4 c = vec4(0.0);
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      vec2 at = transpose(rot) * (cellCentre + vec2(float(i), float(j)) * pitch / 3.0);
      c += texture2D(tColor, clamp(at / resolution, 0.0, 1.0));
    }
    c /= 9.0;

    vec4 racquet = vec4(0.0);
    if (c.a > 0.06) {
      gl_FragColor = vec4(c.rgb / c.a, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      vec3 ink = gl_FragColor.rgb;
      float lum = dot(ink, vec3(0.2126, 0.7152, 0.0722));
      // Radius as a fraction of the pitch: light colours still get a dot that reads as a colour.
      float r = pitch * mix(0.46, 0.72, sqrt(1.0 - lum)) * sqrt(clamp(c.a * 1.6, 0.0, 1.0));
      // Deepen the ink a touch so small dots keep their colour against the wall.
      ink = mix(ink, ink * ink, 0.25);
      float cover = dotCover(d, r);
      racquet = vec4(ink * cover, cover);
    }

    vec3 ground = paper;
    if (reveal > 0.0 && c.a <= 0.06) {
      vec2 st = stageAt(centre / resolution);
      // Bare paper in the pool of light; the plate builds towards the edges and in the shadow.
      float dark = 0.22 * smoothstep(0.25, 0.95, 1.0 - st.r) + 0.5 * st.g;
      ground = mix(paper, groundInk, dotCover(d, pitch * 0.62 * sqrt(clamp(dark, 0.0, 1.0))));
    }
    gl_FragColor = over(racquet, ground);
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
  uniform float hatch;
  uniform vec3 paper;
  uniform vec3 paperEdge;
  ${stageChunk}
  varying vec2 vUv;

  // One set of parallel strokes, as wide as the tone asks for, with a hand's slight unevenness.
  float strokes(vec2 at, float angle, float tone) {
    vec2 dir = vec2(cos(angle), sin(angle));
    float along = dot(at, dir);
    float across = dot(at, vec2(-dir.y, dir.x));
    across += sin(along / hatch * 0.31 + floor(across / hatch) * 2.4) * hatch * 0.06;
    float d = abs(fract(across / hatch) - 0.5) * hatch;
    float w = hatch * 0.24 * tone;
    return tone <= 0.02 ? 0.0 : (1.0 - smoothstep(w - 0.6, w + 0.6, d)) * smoothstep(0.02, 0.16, tone);
  }
  // Warm paper, lit by the same pool, with the shadow hatched in; the deepest part is crossed.
  vec3 ground() {
    if (reveal <= 0.0) return vec3(0.0);
    vec2 st = stageAt(vUv);
    vec3 sheet = mix(paperEdge, paper, st.r);
    float s = strokes(gl_FragCoord.xy, 0.96, st.g);
    s = max(s, 0.8 * strokes(gl_FragCoord.xy, -0.62, smoothstep(0.55, 1.0, st.g)));
    return mix(sheet, ink, s * 0.5);
  }

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
    gl_FragColor = over(vec4(ink * a + base * fa * (1.0 - a), a + fa * (1.0 - a)), ground());
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
    uniforms: { tColor: { value: null }, tStrings: { value: null }, resolution: { value: new Vector2() }, cell: { value: 4 }, levels: { value: LEVELS }, toneDark: { value: srgb(0x9c8a74) }, toneLight: { value: srgb(0xd9ccb7) }, ...stageUniforms() },
    vertexShader: fullscreenVertex,
    fragmentShader: pixelFragment,
  }));
  private readonly halftone = fullscreen(new ShaderMaterial({
    uniforms: { tColor: { value: null }, resolution: { value: new Vector2() }, pitch: { value: 5 }, paper: { value: srgb(0xd9cdba) }, groundInk: { value: srgb(0xa08c74) }, ...stageUniforms() },
    vertexShader: fullscreenVertex,
    fragmentShader: halftoneFragment,
  }));
  private halftoneTarget: WebGLRenderTarget | null = null;
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
      hatch: { value: 7 },
      paper: { value: srgb(0xeee6d9) },
      paperEdge: { value: srgb(0xd9cdbb) },
      ...stageUniforms(),
    },
    vertexShader: fullscreenVertex,
    fragmentShader: lineFragment,
    toneMapped: false,
  }));
  private readonly bodyMaterial = new ShaderMaterial({ uniforms: { marker: { value: 1 } }, vertexShader: gbufferVertex, fragmentShader: gbufferFragment, side: DoubleSide, blending: NoBlending, toneMapped: false });
  private readonly stringMaterial = new ShaderMaterial({ uniforms: { marker: { value: 0.5 } }, vertexShader: gbufferVertex, fragmentShader: gbufferFragment, side: DoubleSide, blending: NoBlending, toneMapped: false });
  private readonly depthOnly = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
  private readonly swapped: Array<[Mesh, Material | Material[]]> = [];
  private fillTarget: WebGLRenderTarget | null = null;
  private stringTarget: WebGLRenderTarget | null = null;
  /** Unlit copies of the models' materials (same colour, same vertex colours), made once each and gone with their originals. */
  private readonly flat = new WeakMap<Material, MeshBasicMaterial>();

  private flatFor(material: Material): MeshBasicMaterial {
    let f = this.flat.get(material);
    if (!f) {
      const m = material as MeshStandardMaterial;
      f = new MeshBasicMaterial({ color: m.color, vertexColors: m.vertexColors, side: DoubleSide, toneMapped: false });
      const copy = f;
      const forget = () => {
        material.removeEventListener('dispose', forget);
        copy.dispose();
        this.flat.delete(material);
      };
      material.addEventListener('dispose', forget);
      this.flat.set(material, f);
    }
    return f;
  }

  /** Draw these meshes flat until `unswap`. */
  private flatten(meshes: Iterable<Object3D>) {
    for (const o of meshes) {
      const m = o as Mesh;
      if (Array.isArray(m.material)) continue;
      this.swapped.push([m, m.material]);
      m.material = this.flatFor(m.material);
    }
  }

  private unswap() {
    for (const [m, material] of this.swapped) m.material = material;
    this.swapped.length = 0;
  }

  constructor(private readonly renderer: WebGLRenderer) {}

  setLook(look: Look): void {
    this.look = look;
  }

  /**
   * Draw `scene` to the canvas in the current look. `scale` is device px per CSS px. `stage` is the
   * alcove to draw behind it; without one the racquet stands on a clear canvas.
   */
  render(scene: Scene, camera: Camera, scale: number, sizes: LookScale, stage: LookStage | null = null): void {
    const r = this.renderer;
    for (const { material } of [this.pixel, this.halftone, this.line]) {
      material.uniforms.tStage.value = stage?.data ?? null;
      material.uniforms.reveal.value = stage?.reveal ?? 0;
    }
    if (this.look === 'realistic') {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.getDrawingBufferSize(this.size);
    const w = this.size.x;
    const h = this.size.y;
    if (w === 0 || h === 0) return;
    const marked = camera.layers.isEnabled(MARKER_LAYER);
    camera.layers.disable(MARKER_LAYER);
    if (this.look === 'pixel') this.renderPixel(scene, camera, w, h, Math.max(1, Math.round(sizes.cell * scale)));
    else if (this.look === 'halftone') this.renderHalftone(scene, camera, w, h, Math.max(3, sizes.dot * scale));
    else this.renderLine(scene, camera, w, h, scale, sizes);
    if (marked) this.renderMarker(scene, camera);
  }

  /** The balance marker as it is, over the finished drawing, hidden only where the racquet stands before it. */
  private renderMarker(scene: Scene, camera: Camera) {
    const r = this.renderer;
    const shadows = r.shadowMap.autoUpdate;
    const clear = r.autoClear;
    r.shadowMap.autoUpdate = r.autoClear = false;
    scene.overrideMaterial = this.depthOnly;
    r.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.set(MARKER_LAYER);
    r.render(scene, camera);
    camera.layers.enable(0);
    r.shadowMap.autoUpdate = shadows;
    r.autoClear = clear;
  }

  private renderHalftone(scene: Scene, camera: Camera, w: number, h: number, pitch: number) {
    const r = this.renderer;
    // Full resolution, linear and half float: the screen samples it at each dot's centre.
    this.halftoneTarget ??= new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: true, samples: 4 });
    const t = this.halftoneTarget;
    if (t.width !== w || t.height !== h) t.setSize(w, h);
    r.setRenderTarget(t);
    r.render(scene, camera);
    r.setRenderTarget(null);
    const u = this.halftone.material.uniforms;
    u.tColor.value = t.texture;
    u.resolution.value.set(w, h);
    u.pitch.value = pitch;
    r.render(this.halftone.scene, this.quadCamera);
  }

  private renderPixel(scene: Scene, camera: Camera, w: number, h: number, cell: number) {
    const r = this.renderer;
    const lw = Math.ceil(w / cell);
    const lh = Math.ceil(h / cell);
    // Half float keeps highlights above 1 so the blit's tone mapping matches Realistic.
    this.colorTarget ??= new WebGLRenderTarget(lw, lh, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true, samples: 4 });
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
    this.flatten(strings);
    // Multisampled: a string is thinner than a texel, and one that is missed shows as a hole in a dark bed or a blotch in a hybrid.
    this.stringTarget ??= new WebGLRenderTarget(lw * 4, lh * 4, { type: HalfFloatType, depthBuffer: true, samples: 4 });
    const st = this.stringTarget;
    if (st.width !== lw * 4 || st.height !== lh * 4) st.setSize(lw * 4, lh * 4);
    r.setRenderTarget(st);
    r.render(scene, camera);
    this.unswap();
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
    this.unswap();

    // Flat colour pass: the same scene unlit, in linear colour (converted in the line shader).
    this.fillTarget ??= new WebGLRenderTarget(w, h, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true });
    const f = this.fillTarget;
    if (f.width !== w || f.height !== h) f.setSize(w, h);
    const meshes: Object3D[] = [];
    scene.traverse((o: Object3D) => void ((o as Mesh).isMesh && meshes.push(o)));
    this.flatten(meshes);
    r.setRenderTarget(f);
    r.render(scene, camera);
    r.setRenderTarget(null);
    this.unswap();

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
    u.hatch.value = sizes.hatch * scale;
    r.render(this.line.scene, this.quadCamera);
  }
}
