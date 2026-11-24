// The detail view's orbitable model. A second, long-lived WebGL context: created on the first
// detail visit and reused for every racquet after that.
import { Box3, MathUtils, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type Object3D, type WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Alcove } from './alcove';
import { createRenderer, createStudio, loadModel, prefersReducedMotion, type Studio } from './studio';
import { between, ease, fitDistance, holdTarget, partBoxes, type Pose } from './view-math';
import type { PartView } from './parts';
import { LookPainter, type LookScale } from './look-passes';
import type { Look } from './look';

const FOV = 28;
const KEY_TURN = Math.PI / 24;
/** Shift + arrow moves this far, CSS px. */
const KEY_PAN = 48;
const GLIDE_MS = 720;
/** The alcove's light comes up once the racquet has landed (its flight in takes 800 ms). */
const REVEAL_AFTER_MS = 350;
const REVEAL_MS = 900;
/** Stage-sized cells and lines, in CSS px. */
const LOOK_SCALE: LookScale = { cell: 6, outline: 1.5, dot: 6 };

export class Viewer {
  readonly canvas: HTMLCanvasElement;
  private readonly studio: Studio;
  private readonly alcove = new Alcove();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.01, 20);
  private readonly controls: OrbitControls;
  private readonly resized: ResizeObserver;
  private readonly painter: LookPainter;
  private model: Object3D | null = null;
  private frame = 0;
  private dirty = true;
  private request = 0;
  /** How far back the camera stands to fit the model on show. */
  private distance = 1;
  private readonly box = new Box3();
  private look: Look = 'realistic';
  private home: Pose = { target: new Vector3(), offset: new Vector3(0, 0, 1) };
  private glide: { from: Pose; to: Pose; start: number; done: () => void } | null = null;
  private lit = 0; // when the alcove's light began to come up; 0 before the first racquet

  static create(): Viewer | null {
    const renderer = createRenderer();
    return renderer ? new Viewer(renderer) : null;
  }

  private constructor(private readonly renderer: WebGLRenderer) {
    this.canvas = renderer.domElement;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.studio = createStudio(renderer);
    this.alcove.reveal = 0;
    this.painter = new LookPainter(renderer);
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.zoomToCursor = true;
    c.autoRotateSpeed = 1.2;
    c.addEventListener('start', () => this.takeOver());
    c.addEventListener('change', () => (this.dirty = true));
    this.controls = c;
    // OrbitControls claims every touch. Let vertical swipes scroll the page instead, so a
    // phone user can get past the model; sideways swipes turn it, two fingers move and zoom it.
    this.canvas.style.touchAction = 'pan-y';
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault(); // or the page scrolls under a two-finger move
    }, { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this.approach(e));
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
    if (!this.frame) this.frame = requestAnimationFrame(this.loop);
  }

  detach(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.glide = null;
    this.lit = 0;
    this.alcove.reveal = 0;
    this.resized.disconnect();
    this.canvas.remove();
  }

  /**
   * Load and frame a model. The one on show stays until the new one is ready; with `keepView` the
   * new one takes its place at the same angle, zoom and spot on the racquet. Rejects if the file fails to load.
   */
  async show(url: string, keepView = false): Promise<void> {
    const ticket = ++this.request;
    const source = await loadModel(url);
    if (ticket !== this.request) return; // a newer request won
    const c = this.controls;
    const view = keepView && this.model
      ? {
          offset: this.camera.position.clone().sub(c.target).divideScalar(this.distance),
          spot: c.target.clone().sub(this.box.getCenter(new Vector3())).divideScalar(this.distance),
          autoRotate: c.autoRotate,
        }
      : null;
    this.glide = null;
    if (this.model) this.studio.scene.remove(this.model);
    this.model = source.clone();
    this.studio.scene.add(this.model);
    this.lit ||= performance.now();
    this.frameModel();
    if (view) {
      c.target.addScaledVector(view.spot, this.distance);
      this.camera.position.copy(c.target).addScaledVector(view.offset, this.distance);
      c.autoRotate = view.autoRotate;
      c.update();
    }
  }

  /** Draw in `look` from the next frame. */
  setLook(look: Look): void {
    this.look = look;
    this.painter.setLook(look);
    this.dirty = true;
  }

  clear(): void {
    this.request++;
    if (this.model) this.studio.scene.remove(this.model);
    this.model = null;
    this.dirty = true;
  }

  reset(): void {
    this.glideTo(this.home, () => (this.controls.autoRotate = !prefersReducedMotion()));
  }

  /** Move in on one part of the racquet, from the side the camera is already on. */
  focus(part: PartView): void {
    if (!this.model) return;
    const box = partBoxes(this.model)[part];
    this.moveIn(box.getCenter(new Vector3()), fitDistance(box, FOV, this.camera.aspect));
  }

  /** Arrow keys turn, Shift + arrows move, +/- zoom. Returns true when the key was handled. */
  key(e: KeyboardEvent): boolean {
    const c = this.controls;
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(e.key);
    if (!handled || e.metaKey || e.ctrlKey || e.altKey) return false;
    this.takeOver();
    const pan = e.shiftKey && e.key.startsWith('Arrow');
    const x = Number(e.key === 'ArrowRight') - Number(e.key === 'ArrowLeft');
    const y = Number(e.key === 'ArrowDown') - Number(e.key === 'ArrowUp');
    // Shift + an arrow looks further that way: the racquet slides the other way.
    if (pan) c.pan(-x * KEY_PAN, -y * KEY_PAN);
    else if (x) c.rotateLeft(x * KEY_TURN);
    else if (y) c.rotateUp(y * KEY_TURN);
    if (e.key === '+' || e.key === '=') c.dollyOut(1.15);
    if (e.key === '-' || e.key === '_') c.dollyIn(1.15);
    this.dirty = true;
    return true;
  }

  /** The visitor has hold of the view: stop anything moving it for them. */
  private takeOver() {
    this.controls.autoRotate = false;
    this.glide = null;
  }

  /** Double click: move in on the spot under the pointer; on empty wall, back to the whole racquet. */
  private approach(e: MouseEvent) {
    if (!this.model) return;
    const r = this.canvas.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2), this.camera);
    let spot: Vector3 | null = ray.intersectObject(this.model)[0]?.point ?? null;
    if (!spot) {
      // Between the strings is still the string bed.
      const bed = new Box3();
      for (const name of ['strings_mains', 'strings_crosses']) {
        const part = this.model.getObjectByName(name);
        if (part) bed.expandByObject(part);
      }
      const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), 0), new Vector3());
      if (hit && bed.expandByScalar(0.002).containsPoint(hit)) spot = hit;
    }
    if (!spot) return this.reset();
    const away = this.camera.position.distanceTo(this.controls.target);
    this.moveIn(spot, Math.min(away, this.distance * 0.32));
  }

  private moveIn(target: Vector3, distance: number) {
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(MathUtils.clamp(distance, this.controls.minDistance, this.controls.maxDistance));
    this.glideTo({ target, offset });
  }

  private glideTo(to: Pose, done: () => void = () => {}) {
    const c = this.controls;
    c.autoRotate = false;
    // Drop what is left of a flick, or it would keep pushing after the glide lands.
    c.enableDamping = false;
    c.update();
    c.enableDamping = true;
    const from: Pose = { target: c.target.clone(), offset: this.camera.position.clone().sub(c.target) };
    this.glide = { from, to: { target: to.target.clone(), offset: to.offset.clone() }, start: performance.now(), done };
    if (prefersReducedMotion()) this.glide.start -= GLIDE_MS;
  }

  /** One frame of a glide. */
  private step(now: number) {
    const g = this.glide;
    if (!g) return;
    const t = (now - g.start) / GLIDE_MS;
    const at = between(g.from, g.to, ease(t));
    this.controls.target.copy(at.target);
    this.camera.position.copy(at.target).add(at.offset);
    this.dirty = true;
    if (t < 1) return;
    this.glide = null;
    g.done();
  }

  private frameModel() {
    const c = this.controls;
    const center = this.box.setFromObject(this.model!).getCenter(new Vector3());
    // Fit the whole frame with a margin, whichever of height or width is the tighter fit.
    const distance = (this.distance = fitDistance(this.box, FOV, this.camera.aspect));
    c.target.copy(center);
    const yaw = -0.45;
    const pitch = 0.12;
    this.camera.position.set(
      center.x + distance * Math.sin(yaw) * Math.cos(pitch),
      center.y + distance * Math.sin(pitch),
      center.z + distance * Math.cos(yaw) * Math.cos(pitch),
    );
    c.minDistance = distance * 0.1;
    c.maxDistance = distance * 1.7;
    c.update();
    this.home = { target: c.target.clone(), offset: this.camera.position.clone().sub(c.target) };
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
    // Resizing wipes the canvas, and this runs after the frame's own drawing: draw again now, or
    // the browser paints one blank frame for every step of a window resize.
    this.draw();
  }

  private draw() {
    this.dirty = false;
    const yaw = this.controls.getAzimuthalAngle();
    this.studio.face(yaw);
    // The other looks redraw the racquet alone, on the stage's own flat panel: the alcove leaves
    // the scene, so they never see it.
    const staged = this.look === 'realistic' && this.model !== null;
    if (staged) this.studio.scene.add(this.alcove.node);
    else this.alcove.node.removeFromParent();
    if (staged) this.alcove.update(this.renderer, this.studio.scene, yaw, this.box.min.y);
    this.painter.render(this.studio.scene, this.camera, this.renderer.getPixelRatio(), LOOK_SCALE);
  }

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const c = this.controls;
    this.step(now);
    if (c.update()) this.dirty = true;
    if (c.autoRotate && this.model) this.dirty = true;
    if (this.model && !this.glide) {
      const moved = holdTarget(c.target, this.box, this.camera.position.distanceTo(c.target), this.distance);
      if (moved.lengthSq() > 0) {
        this.camera.position.add(moved);
        this.dirty = true;
      }
    }
    if (this.lit && this.lit !== Infinity) {
      const t = prefersReducedMotion() ? 1 : MathUtils.clamp((now - this.lit - REVEAL_AFTER_MS) / REVEAL_MS, 0, 1);
      this.alcove.reveal = MathUtils.smoothstep(t, 0, 1);
      this.dirty = true;
      if (t === 1) this.lit = Infinity;
    }
    if (this.dirty) this.draw();
  };
}
