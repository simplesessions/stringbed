// The detail view's orbitable model. A second, long-lived WebGL context: created on the first
// detail visit and reused for every racquet after that.
import { PerspectiveCamera, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bounds, createRenderer, createStudio, loadModel, prefersReducedMotion } from './studio';

const FOV = 28;
const KEY_TURN = Math.PI / 24;

export class Viewer {
  readonly canvas: HTMLCanvasElement;
  private readonly scene: Scene;
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.01, 20);
  private readonly controls: OrbitControls;
  private readonly resized: ResizeObserver;
  private model: Object3D | null = null;
  private frame = 0;
  private dirty = true;
  private request = 0;

  static create(): Viewer | null {
    const renderer = createRenderer();
    return renderer ? new Viewer(renderer) : null;
  }

  private constructor(private readonly renderer: WebGLRenderer) {
    this.canvas = renderer.domElement;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.scene = createStudio(renderer);
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.autoRotateSpeed = 1.2;
    c.addEventListener('start', () => (c.autoRotate = false));
    c.addEventListener('change', () => (this.dirty = true));
    this.controls = c;
    // OrbitControls claims every touch. Let vertical swipes scroll the page instead, so a
    // phone user can get past the model; sideways swipes turn it and pinches zoom it.
    this.canvas.style.touchAction = 'pan-y';
    this.resized = new ResizeObserver(() => this.fit());
  }

  /** Put the canvas in `host` and start drawing. */
  attach(host: HTMLElement): void {
    if (this.canvas.parentElement !== host) host.prepend(this.canvas);
    this.resized.disconnect();
    this.resized.observe(host);
    this.fit();
    // Every detail render attaches again; start the loop once, or chains pile up and each
    // one runs controls.update() (faster auto-rotation, faster damping, orphan renders).
    if (!this.frame) this.loop();
  }

  detach(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resized.disconnect();
    this.canvas.remove();
  }

  /** Load and frame a model. Rejects if the file fails to load. */
  async show(url: string): Promise<void> {
    const ticket = ++this.request;
    const source = await loadModel(url);
    if (ticket !== this.request) return; // a newer request won
    if (this.model) this.scene.remove(this.model);
    this.model = source.clone();
    this.scene.add(this.model);
    this.frameModel();
  }

  clear(): void {
    this.request++;
    if (this.model) this.scene.remove(this.model);
    this.model = null;
    this.dirty = true;
  }

  reset(): void {
    this.controls.reset();
    this.controls.autoRotate = !prefersReducedMotion();
    this.dirty = true;
  }

  /** Arrow keys turn, +/- zoom. Returns true when the key was handled. */
  key(e: KeyboardEvent): boolean {
    const c = this.controls;
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(e.key);
    if (!handled) return false;
    c.autoRotate = false;
    if (e.key === 'ArrowLeft') c.rotateLeft(-KEY_TURN);
    if (e.key === 'ArrowRight') c.rotateLeft(KEY_TURN);
    if (e.key === 'ArrowUp') c.rotateUp(-KEY_TURN);
    if (e.key === 'ArrowDown') c.rotateUp(KEY_TURN);
    if (e.key === '+' || e.key === '=') c.dollyOut(1.15);
    if (e.key === '-' || e.key === '_') c.dollyIn(1.15);
    this.dirty = true;
    return true;
  }

  private frameModel() {
    const { center, size } = bounds(this.model!);
    const c = this.controls;
    // Fit the whole frame with a margin, whichever of height or width is the tighter fit.
    const vHalf = (FOV * Math.PI) / 360;
    const fitH = (size.y * 0.58) / Math.tan(vHalf);
    const fitW = (Math.max(size.x, size.z) * 0.62) / (Math.tan(vHalf) * this.camera.aspect);
    const distance = Math.max(fitH, fitW);
    c.target.copy(center);
    const yaw = -0.45;
    const pitch = 0.12;
    this.camera.position.set(
      center.x + distance * Math.sin(yaw) * Math.cos(pitch),
      center.y + distance * Math.sin(pitch),
      center.z + distance * Math.cos(yaw) * Math.cos(pitch),
    );
    c.minDistance = distance * 0.25;
    c.maxDistance = distance * 2.5;
    c.update();
    c.saveState();
    c.autoRotate = !prefersReducedMotion();
    this.dirty = true;
  }

  private fit() {
    if (!this.canvas.parentElement) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    if (this.controls.update()) this.dirty = true;
    if (this.controls.autoRotate && this.model) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  };
}
