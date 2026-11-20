// Shared three.js setup: renderer creation, studio lighting, and a GLB cache.
import {
  Box3,
  DirectionalLight,
  NeutralToneMapping,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
    return null;
  }
}

/** A neutral studio: a soft room for reflections plus one key light from the upper left. */
export function createStudio(renderer: WebGLRenderer): Scene {
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(-1.2, 2.2, 2.4);
  scene.add(key);
  return scene;
}

const loader = new GLTFLoader();
const cache = new Map<string, Promise<Object3D>>();

/** Loads a model once per URL. A failed load is forgotten so a retry fetches again. */
export function loadModel(url: string): Promise<Object3D> {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((gltf) => gltf.scene);
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

export function bounds(model: Object3D): { center: Vector3; size: Vector3 } {
  const box = new Box3().setFromObject(model);
  return { center: box.getCenter(new Vector3()), size: box.getSize(new Vector3()) };
}

export const prefersReducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
