// One shared, offscreen WebGL renderer draws every wall thumbnail and hands the frame to that
// entry's own canvas. It renders an entry only when it scrolls into view, changes size, or
// turns on hover, so the page holds one WebGL context however many racquets there are.
// Where OffscreenCanvas has WebGL, frames move as ImageBitmaps into 'bitmaprenderer'
// canvases (no GPU readback); otherwise they are copied with a 2D drawImage.
import { OrthographicCamera, type Object3D, type WebGLRenderer, type Scene } from 'three';
import type { HexColor } from '../../src/core/spec';
import { createRenderer, createStudio, loadModel, prefersReducedMotion, tinted, untint } from './studio';
import { LookPainter, type LookScale } from './look-passes';
import type { Look } from './look';

export type ThumbState = 'idle' | 'loading' | 'ready' | 'failed';

export interface ThumbOptions {
  /** Colours for named parts; without any the model is drawn as it was made. */
  colours?: Record<string, HexColor>;
  /** Metres the frame spans from top to bottom. Its width follows the canvas: a spool needs one at least 1.2 times as wide as tall. */
  fitHeight?: number;
}

type Target = { kind: 'bitmap'; ctx: ImageBitmapRenderingContext } | { kind: '2d'; ctx: CanvasRenderingContext2D };

interface Entry {
  canvas: HTMLCanvasElement;
  target: Target;
  url: string;
  colours: Record<string, HexColor>;
  fitHeight: number;
  onState: (state: ThumbState) => void;
  state: ThumbState;
  model: Object3D | null;
  visible: boolean;
  dirty: boolean;
  yaw: number;
  /** Angular velocity (rad/s) and how awake the racquet is (0 at rest, 1 fully hovered). */
  spin: number;
  wake: number;
  phase: number;
  turning: boolean;
}

/** Resting pose: turned a little off face-on so the beam's depth shows. */
const REST_YAW = -0.38;
const TURN_SPEED = 1.35; // radians per second at cruising speed; it eases up to this and back
const MAX_DPR = 2;
/** Bay-sized cells and lines, in CSS px. */
const LOOK_SCALE: LookScale = { cell: 4, outline: 1, dot: 3, hatch: 5 };

/** Height every thumbnail frames, metres: 29 in, the longest frame the spec allows. */
const FRAME_HEIGHT_M = 0.7366;
/** Room under the model, metres: enough that leaning on hover never dips it out of a short frame. */
const roomBelow = (fitHeight: number) => Math.min(0.012, fitHeight * 0.045);

export class Thumbnails {
  private readonly scene: Scene;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  private readonly entries = new Map<Element, Entry>();
  private readonly seen: IntersectionObserver;
  private readonly resized: ResizeObserver;
  private readonly painter: LookPainter;
  private frame = 0;
  private last = 0;

  static create(): Thumbnails | null {
    const offscreen = typeof OffscreenCanvas === 'function' ? createRenderer(new OffscreenCanvas(1, 1)) : null;
    const renderer = offscreen ?? createRenderer();
    return renderer ? new Thumbnails(renderer, offscreen !== null) : null;
  }

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly transfer: boolean,
  ) {
    renderer.setPixelRatio(1); // we size the drawing buffer in device pixels ourselves
    this.scene = createStudio(renderer, 1024).scene;
    this.painter = new LookPainter(renderer);
    this.camera.position.set(0, 0, 3);
    this.seen = new IntersectionObserver((records) => {
      for (const r of records) {
        const e = this.entries.get(r.target);
        if (!e) continue;
        e.visible = r.isIntersecting;
        if (e.visible) this.wake(e);
      }
    }, { rootMargin: '200px 0px' });
    this.resized = new ResizeObserver((records) => {
      for (const r of records) {
        const e = this.entries.get(r.target);
        if (e) this.mark(e);
      }
    });
  }

  /** Track a canvas. `hoverTarget` is the element whose hover or focus turns the racquet. */
  add(canvas: HTMLCanvasElement, url: string, hoverTarget: HTMLElement, onState: (s: ThumbState) => void, { colours = {}, fitHeight = FRAME_HEIGHT_M }: ThumbOptions = {}): void {
    const bitmap = this.transfer ? canvas.getContext('bitmaprenderer') : null;
    const flat = bitmap ? null : canvas.getContext('2d');
    const target: Target | null = bitmap ? { kind: 'bitmap', ctx: bitmap } : flat ? { kind: '2d', ctx: flat } : null;
    if (!target) return onState('failed');
    const e: Entry = { canvas, target, url, colours, fitHeight, onState, state: 'idle', model: null, visible: false, dirty: true, yaw: REST_YAW, spin: 0, wake: 0, phase: Math.random() * Math.PI * 2, turning: false };
    this.entries.set(canvas, e);
    this.seen.observe(canvas);
    this.resized.observe(canvas);
    const start = () => {
      if (prefersReducedMotion() || e.state !== 'ready') return;
      e.turning = true;
      this.schedule();
    };
    const stop = () => {
      e.turning = false;
      this.schedule();
    };
    hoverTarget.addEventListener('pointerenter', start);
    hoverTarget.addEventListener('pointerleave', stop);
    hoverTarget.addEventListener('focus', start);
    hoverTarget.addEventListener('blur', stop);
  }

  /** Stop tracking canvases that have left the page (the wall was rebuilt). */
  prune(): void {
    for (const [canvas, e] of this.entries) {
      if (e.canvas.isConnected) continue;
      this.seen.unobserve(canvas);
      this.resized.unobserve(canvas);
      if (e.model) untint(e.model);
      this.entries.delete(canvas);
    }
  }

  /** Redraw every loaded bay in `look`. Models stay loaded. */
  setLook(look: Look): void {
    this.painter.setLook(look);
    for (const e of this.entries.values()) if (e.state === 'ready') this.mark(e);
  }

  /** Load again after a failure. */
  retry(canvas: HTMLCanvasElement): void {
    const e = this.entries.get(canvas);
    if (e && e.state === 'failed') {
      e.state = 'idle';
      this.wake(e);
    }
  }

  private setState(e: Entry, state: ThumbState) {
    e.state = state;
    e.onState(state);
  }

  private wake(e: Entry) {
    if (e.state === 'idle') {
      this.setState(e, 'loading');
      loadModel(e.url).then(
        (source) => {
          // Turn a clone, never the cached source: the detail viewer clones that source and
          // must start from the file's own pose. Clones share geometry and materials.
          e.model = tinted(source, e.colours);
          this.setState(e, 'ready');
          this.mark(e);
        },
        () => this.setState(e, 'failed'),
      );
    } else {
      this.mark(e);
    }
  }

  private mark(e: Entry) {
    e.dirty = true;
    this.schedule();
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number) {
    this.frame = 0;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 1 / 60;
    this.last = now;
    let again = false;
    for (const e of this.entries.values()) {
      if (e.state !== 'ready' || !e.visible) continue;
      // Inertia, not a motor: hovering spins the frame up, leaving lets a spring settle it back to
      // rest with a small overshoot, and the speed drifts so no two racquets move alike.
      const full = Math.PI * 2;
      if (e.turning) {
        const drift = 1 + 0.18 * Math.sin(now / 700 + e.phase);
        e.spin += (TURN_SPEED * drift - e.spin) * (1 - Math.exp(-dt * 3.2));
        e.wake += (1 - e.wake) * (1 - Math.exp(-dt * 5));
      } else {
        const target = REST_YAW + Math.round((e.yaw - REST_YAW) / full) * full;
        e.spin += (-52 * (e.yaw - target) - 7.5 * e.spin) * dt; // underdamped spring
        e.wake += (0 - e.wake) * (1 - Math.exp(-dt * 4));
        if (Math.abs(e.yaw - target) < 0.002 && Math.abs(e.spin) < 0.02 && e.wake < 0.01) {
          e.yaw = REST_YAW;
          e.spin = 0;
          e.wake = 0;
        }
      }
      if (e.turning || e.yaw !== REST_YAW || e.spin !== 0 || e.wake !== 0) {
        e.yaw += e.spin * dt;
        e.dirty = true;
        again = true;
      }
      if (e.dirty) this.draw(e);
    }
    if (again) this.schedule();
    else this.last = 0;
  }

  private draw(e: Entry) {
    const model = e.model!;
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(e.canvas.clientWidth * dpr);
    const h = Math.round(e.canvas.clientHeight * dpr);
    e.dirty = false;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);

    model.rotation.y = e.yaw;
    // A slow lean while awake, so the frame turns like an object in a hand, not a pole.
    model.rotation.z = Math.sin(e.yaw + e.phase) * 0.04 * e.wake;
    model.rotation.x = Math.sin(e.yaw * 0.5 + 1.3) * 0.03 * e.wake;
    model.updateMatrixWorld(true);
    // One true scale for every racquet: the frame is a fixed 29 in tall with the butt cap (the
    // model's origin) on the rail, so a 25 in junior stands visibly shorter than a 27 in frame.
    const halfH = (e.fitHeight * 1.03) / 2;
    const halfW = halfH * (w / h);
    const cam = this.camera;
    cam.left = -halfW;
    cam.right = halfW;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.position.set(0, halfH - roomBelow(e.fitHeight), 3);
    cam.updateProjectionMatrix();

    this.scene.add(model);
    this.painter.render(this.scene, cam, dpr, LOOK_SCALE);
    this.scene.remove(model);
    const t = e.target;
    if (t.kind === 'bitmap') {
      t.ctx.transferFromImageBitmap((this.renderer.domElement as unknown as OffscreenCanvas).transferToImageBitmap());
    } else {
      if (e.canvas.width !== w || e.canvas.height !== h) {
        e.canvas.width = w;
        e.canvas.height = h;
      }
      t.ctx.clearRect(0, 0, w, h);
      t.ctx.drawImage(this.renderer.domElement, 0, 0);
    }
  }
}
