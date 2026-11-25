// Shared three.js setup: renderer creation, studio lighting, and a GLB cache.
import {
  BackSide,
  BufferAttribute,
  type BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { HexColor } from '../../src/core/spec';
import { fetchModelBytes } from './prefetch';

/** Creates a renderer, or returns null when the browser cannot give us WebGL. */
export function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas = document.createElement('canvas')): WebGLRenderer | null {
  // Ask for the context ourselves and hand it to three, so a browser without WebGL is
  // detected without an extra probe context and without three logging an error.
  const attributes: WebGLContextAttributes = { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' };
  const context = canvas.getContext('webgl2', attributes) as WebGL2RenderingContext | null;
  if (!context) return null;
  try {
    const renderer = new WebGLRenderer({ canvas, context, ...attributes });
    renderer.outputColorSpace = SRGBColorSpace;
    // Neutral keeps base colours close to their hex values; ACES would warm the whites and
    // push the yellows towards orange.
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    return renderer;
  } catch {
    // Release the context we created, so a fallback renderer cannot push the page past two.
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}

/** Where the key light stands, seen from the racquet: upper left, in front. */
export const KEY_DIRECTION = new Vector3(-0.55, 0.72, 1).normalize();
/** The racquet's middle, which the lights aim at. */
const AIM = new Vector3(0, 0.34, 0);

/**
 * The room the racquet reflects: a dim warm shell with a big softbox at upper left, a weak cool
 * fill at right and two tall strips behind that draw a bright line down each edge of the beam.
 * Colours are linear and go above 1 (they are light, not paint).
 */
function softboxRoom(): Scene {
  const room = new Scene();
  const box = new SphereGeometry(10, 32, 16);
  const up = box.getAttribute('position');
  const floor = new Color(0.3, 0.255, 0.215);
  const middle = new Color(0.4, 0.388, 0.372);
  const ceiling = new Color(0.8, 0.775, 0.74);
  const c = new Color();
  const tint = new Float32Array(up.count * 3);
  for (let i = 0; i < up.count; i++) {
    const h = up.getY(i) / 10;
    c.copy(middle).lerp(h > 0 ? ceiling : floor, Math.pow(Math.abs(h), 0.8)).toArray(tint, i * 3);
  }
  box.setAttribute('color', new BufferAttribute(tint, 3));
  room.add(new Mesh(box, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
  const softbox = (w: number, h: number, at: [number, number, number], rgb: [number, number, number], power: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(...rgb).multiplyScalar(power), side: DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  softbox(4.4, 5.2, [-4.2, 4.2, 5.2], [1, 0.982, 0.955], 6);
  softbox(3.2, 5, [6, 1.2, 4], [0.9, 0.955, 1], 1.9);
  softbox(1.5, 7, [-6, 1.5, -2.6], [1, 0.95, 0.88], 10);
  softbox(1.5, 7, [6, 1.8, -2.2], [1, 0.97, 0.93], 12);
  softbox(4, 3, [0, 7, 0.5], [1, 0.975, 0.94], 3.4);
  return room;
}

export interface Studio {
  scene: Scene;
  /**
   * Bring the lights round to a viewer standing at `yaw`. The viewer walks round the racquet, but
   * it should read as the racquet turning under fixed lamps: highlights run along the beam.
   * `under` (0 to 1) brings up a soft glow from below, for looking up at the butt cap.
   */
  face(yaw: number, under: number): void;
}

/** A warm showcase: the softbox room, a key light that casts soft shadows, and a rim from behind. */
export function createStudio(renderer: WebGLRenderer, shadowPx = 2048): Studio {
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = softboxRoom();
  scene.environment = pmrem.fromScene(room, 0.02).texture;
  scene.environmentIntensity = 1.12;
  room.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    o.material.dispose();
  });
  pmrem.dispose();

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const rig = new Group();
  const key = new DirectionalLight(0xfff9f2, 1.65);
  key.position.copy(KEY_DIRECTION).multiplyScalar(2).add(AIM);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowPx, shadowPx);
  Object.assign(key.shadow.camera, { left: -0.45, right: 0.45, top: 0.45, bottom: -0.45, near: 1, far: 3 });
  key.shadow.radius = 2.5;
  key.shadow.normalBias = 0.0012;
  key.shadow.bias = -0.0004;
  key.shadow.intensity = 0.62; // soft: the room fills what the key misses
  const rim = new DirectionalLight(0xffecd8, 1.3);
  rim.position.set(1.3, 1, -1.5).add(AIM);
  const glow = new DirectionalLight(0xfff0dd, 0);
  glow.position.set(0.5, -1.6, 0.9).add(AIM);
  for (const light of [key, rim, glow]) {
    light.target.position.copy(AIM);
    rig.add(light, light.target);
  }
  scene.add(rig);
  return {
    scene,
    face(yaw, under) {
      rig.rotation.y = yaw;
      glow.intensity = 1.1 * under;
      scene.environmentRotation.y = yaw;
    },
  };
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<Object3D>>();

/** Loads a model once per URL. A failed load is forgotten so a retry fetches again. */
export function loadModel(url: string): Promise<Object3D> {
  let pending = cache.get(url);
  if (!pending) {
    // The bytes were usually requested long ago (prefetch.ts); parse a copy of them here.
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    pending = fetchModelBytes(url).then((bytes) => loader.parseAsync(bytes.slice(0), base)).then((gltf) => {
      // Parts shade one another: the hoop on its far side, the throat on the shaft. Clones keep
      // this. Strings only cast: they are thinner than a shadow texel and would break into dashes.
      gltf.scene.traverse((o) => {
        o.castShadow = (o as Mesh).isMesh === true;
        o.receiveShadow = o.castShadow && !o.name.startsWith('strings');
      });
      return gltf.scene;
    });
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

/** Materials made by `tinted`, so `untint` can tell them from the shared ones. */
const tints = new WeakSet<MeshStandardMaterial>();

/**
 * A clone of `source` with the named meshes in other colours. Each gets its own copy of its material
 * (clones share theirs with the cached source, so recolouring in place would repaint every one of
 * them); everything else stays shared. Give the copies back with `untint`.
 */
export function tinted(source: Object3D, colours: Record<string, HexColor>): Object3D {
  const model = source.clone();
  for (const [name, hex] of Object.entries(colours)) {
    const part = model.getObjectByName(name) as Mesh<BufferGeometry, MeshStandardMaterial> | undefined;
    if (!part?.isMesh) continue;
    part.material = part.material.clone();
    part.material.color.set(hex);
    tints.add(part.material);
  }
  return model;
}

/** Dispose the materials `tinted` made for this model. Any other model is left alone. */
export function untint(model: Object3D): void {
  model.traverse((o) => {
    const material = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (material && tints.has(material)) material.dispose();
  });
}

export const prefersReducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
