// One shared, offscreen WebGL renderer draws every wall thumbnail and hands the frame to that
// entry's own canvas. It renders an entry only when it scrolls into view, changes size, or
// turns on hover, so the page holds one WebGL context however many racquets there are.
// Where OffscreenCanvas has WebGL, frames move as ImageBitmaps into 'bitmaprenderer'
// canvases (no GPU readback); otherwise they are copied with a 2D drawImage.
import { OrthographicCamera, type Object3D, type WebGLRenderer, type Scene } from 'three';
import { bounds, createRenderer, createStudio, loadModel, prefersReducedMotion } from './studio';
import { LookPainter, type LookScale } from './look-passes';
import type { Look } from './look';

export type ThumbState = 'idle' | 'loading' | 'ready' | 'failed';

type Target = { kind: 'bitmap'; ctx: ImageBitmapRenderingContext } | { kind: '2d'; ctx: CanvasRenderingContext2D };

interface Entry {
  canvas: HTMLCanvasElement;
  target: Target;
  url: string;
  onState: (state: ThumbState) => void;
  state: ThumbState;
  model: Object3D | null;
  visible: boolean;
  dirty: boolean;
  yaw: number;
  turning: boolean;
}

/** Resting pose: turned a little off face-on so the beam's depth shows. */
const REST_YAW = -0.38;
const TURN_SPEED = 1.1; // radians per second while hovered
const MAX_DPR = 2;
/** Bay-sized cells and lines, in CSS px. */
const LOOK_SCALE: LookScale = { cell: 4, outline: 1 };

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
    this.scene = createStudio(renderer);
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
  add(canvas: HTMLCanvasElement, url: string, hoverTarget: HTMLElement, onState: (s: ThumbState) => void): void {
    const bitmap = this.transfer ? canvas.getContext('bitmaprenderer') : null;
    const flat = bitmap ? null : canvas.getContext('2d');
    const target: Target | null = bitmap ? { kind: 'bitmap', ctx: bitmap } : flat ? { kind: '2d', ctx: flat } : null;
    if (!target) return onState('failed');
    const e: Entry = { canvas, target, url, onState, state: 'idle', model: null, visible: false, dirty: true, yaw: REST_YAW, turning: false };
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
          e.model = source.clone();
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
      if (e.turning) {
        e.yaw += TURN_SPEED * dt;
        e.dirty = true;
        again = true;
      } else if (e.yaw !== REST_YAW) {
        // Ease back to the nearest resting turn, exponentially.
        const full = Math.PI * 2;
        const target = REST_YAW + Math.round((e.yaw - REST_YAW) / full) * full;
        const next = target + (e.yaw - target) * Math.exp(-dt * 6);
        e.yaw = Math.abs(next - target) < 0.002 ? REST_YAW : next;
        e.dirty = true;
        again = e.yaw !== REST_YAW;
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
    model.updateMatrixWorld(true);
    const { center, size } = bounds(model);
    // One scale for every racquet: frame by height, so the wall compares like with like.
    const halfH = (size.y * 1.08) / 2;
    const halfW = halfH * (w / h);
    const cam = this.camera;
    cam.left = -halfW;
    cam.right = halfW;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.position.set(0, center.y, 3);
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
