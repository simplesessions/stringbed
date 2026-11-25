// The detail view's orbitable model. A second, long-lived WebGL context: created on the first
// detail visit and reused for every racquet after that.
import {
  Box3,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Shape,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type Ray,
  type WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Alcove } from './alcove';
import type { Finish, HexColor } from '../../src/core/spec';
import { DAMPENER_CORNER, DAMPENER_DEPTH, DAMPENER_HEIGHT, DAMPENER_SEGMENTS, DAMPENER_WIDTH } from '../../src/core/trim';
import { dampenerMass } from '../../src/mass';
import { bedLines, restring, type Beds, type Strand } from '../../src/restring';
import { ROUGHNESS } from '../../src/styles/finish';
import { placeTape, tapeGeometry, type TapePiece } from '../../src/tape';
import { createRenderer, createStudio, loadModel, prefersReducedMotion, tinted, untint, type Studio } from './studio';
import { between, ease, fitDistance, fitModel, holdTarget, nearSide, partBoxes, presence, type Pose } from './view-math';
import type { PartView } from './parts';
import { LookPainter, MARKER_LAYER, type LookScale } from './look-passes';
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
const LOOK_SCALE: LookScale = { cell: 6, outline: 1.5, dot: 4.5, hatch: 7 };

export interface ShowOptions {
  /** Colours for named parts; without any the model is drawn as it was made. */
  colours?: Record<string, HexColor>;
  /** The lights, shadows and alcove are sized for a racquet: a small model is drawn this much larger. */
  scale?: number;
}

/** What a racquet wears over its stock self. */
export interface Dress {
  strings: { mains: Strand; crosses: Strand } | null;
  tape: TapePiece[];
  overgrip: HexColor | null;
  dampener: HexColor | null;
  balanceMm: number | null;
}

/** Where tape can go, and what a pick finds. */
const SURFACE = ['frame', 'collar', 'grip'];
const LEAD: HexColor = '#9a9ea3';
/** The dampener's edges stay this far off the lowest cross's middle and the bridge, metres. */
const DAMPENER_GAP = 0.001;
/** The balance marker: a band this tall, standing this far off the racquet, metres. */
const MARKER_HEIGHT = 0.003;
const MARKER_OFF = 0.004;

const surfaceParts = (root: Object3D): Mesh[] => SURFACE.flatMap((name) => {
  const part = root.getObjectByName(name) as Mesh | undefined;
  return part?.isMesh ? [part] : [];
});

/** The point on the frame, collar or grip a ray meets first, whatever else is in its way, in racquet space. */
export function surfaceUnder(root: Object3D, ray: Raycaster): Vector3 | null {
  root.updateWorldMatrix(true, true);
  const hit = ray.intersectObjects(surfaceParts(root), false)[0];
  return hit ? root.worldToLocal(hit.point) : null;
}

/** How far the racquet reaches to the side and to the front at a height. Null where there is none of it. */
function reachAt(root: Object3D, y: number): { x: number; z: number } | null {
  const a = new Vector3();
  const b = new Vector3();
  let x = 0;
  let z = 0;
  for (const part of surfaceParts(root)) {
    part.updateMatrix();
    const pos = part.geometry.getAttribute('position');
    const index = part.geometry.index!;
    for (let i = 0; i < index.count; i++) {
      a.fromBufferAttribute(pos, index.getX(i)).applyMatrix4(part.matrix);
      b.fromBufferAttribute(pos, index.getX(i % 3 === 2 ? i - 2 : i + 1)).applyMatrix4(part.matrix);
      if (a.y > y === b.y > y) continue;
      a.lerp(b, (y - a.y) / (b.y - a.y));
      x = Math.max(x, Math.abs(a.x));
      z = Math.max(z, Math.abs(a.z));
    }
  }
  return x ? { x, z } : null;
}

/** A band of unit size round the racquet's axis, squarish to clear the beam's corners. Ink edges and a paper middle: it reads on any paint. */
function markerMesh(): Mesh<BufferGeometry, MeshBasicMaterial> {
  const g = new CylinderGeometry(1, 1, MARKER_HEIGHT, 64, 5, true);
  const pos = g.getAttribute('position');
  const colours = new Float32Array(pos.count * 3);
  const ink = new Color(0x201c18);
  const paper = new Color(0xeee6d9);
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getX(i) ** 6 + pos.getZ(i) ** 6) ** (-1 / 6);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
    (Math.abs(pos.getY(i)) < MARKER_HEIGHT / 5 ? paper : ink).toArray(colours, i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colours, 3));
  const m = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, toneMapped: false }));
  m.name = 'marker_balance';
  m.layers.set(MARKER_LAYER);
  return m;
}

/**
 * As buildDampener makes it, but where it is weighed, and no taller than the space there: published
 * models leave 6 mm between the bridge and the lowest cross.
 */
function dampenerGeometry(beds: Beds): BufferGeometry {
  const { x: xc, y: yc } = dampenerMass(beds);
  const lowest = Math.min(...beds.crosses.lines.map((l) => l.at));
  const nearest = Math.min(...beds.mains.lines.map((l) => Math.abs(l.at - xc))); // half the space between the two mains
  const w = Math.min(DAMPENER_WIDTH, 2 * nearest * 0.7);
  const h = Math.min(DAMPENER_HEIGHT, 2 * (lowest - DAMPENER_GAP - yc));
  const r = Math.min(DAMPENER_CORNER, w / 3, h / 3);
  const [right, top] = [w / 2 - r, h / 2 - r];
  const outline = new Shape();
  for (const [x, y, turn] of [[right, -top, -0.5], [right, top, 0], [-right, top, 0.5], [-right, -top, 1]]) outline.absarc(x, y, r, turn * Math.PI, (turn + 0.5) * Math.PI);
  return new ExtrudeGeometry(outline, { depth: DAMPENER_DEPTH, bevelEnabled: false, curveSegments: DAMPENER_SEGMENTS })
    .translate(xc, yc, -DAMPENER_DEPTH / 2);
}

const strandSays = (s: Strand) => [s.color, s.finish, s.gaugeMm, s.sides].join();
const pieceSays = (p: TapePiece) => [p.zone, p.at, p.mirrored, p.lengthMm, p.layers].join();

/** What one model has on. The model is a clone that shares its parts with every other, so everything worn is made new and disposed when it comes off. */
export class Outfit {
  /** How to take off each thing it has on. */
  private readonly worn = new Map<string, () => void>();
  private marker: ReturnType<typeof markerMesh> | null = null;
  private balance = '';

  constructor(readonly root: Object3D, readonly beds: Beds) {}

  /** The balance marker is out. */
  get marked(): boolean {
    return this.marker !== null;
  }

  /** Put on what differs from what it has on; null is stock. Returns whether anything changed. */
  wear(d: Dress | null): boolean {
    const { strings, tape, overgrip, dampener, balanceMm } = d ?? { strings: null, tape: [], overgrip: null, dampener: null, balanceMm: null };
    // Each thing worn goes by what it is, so one that stays is left alone. Laying tape is slow: every piece is its own thing.
    const wanted = new Map<string, () => () => void>();
    if (strings) wanted.set(`strings ${strandSays(strings.mains)} ${strandSays(strings.crosses)}`, () => restring(this.root, strings.mains, strings.crosses)!);
    if (overgrip) wanted.set(`overgrip ${overgrip}`, () => this.wrap(overgrip));
    if (dampener) wanted.set(`dampener ${dampener}`, () => this.add('dampener', [dampenerGeometry(this.beds)], dampener, 'satin', true));
    for (const p of tape) {
      let nth = 1; // of the pieces just like it
      while (wanted.has(`tape ${pieceSays(p)} ${nth}`)) nth++;
      wanted.set(`tape ${pieceSays(p)} ${nth}`, () => this.add('tape', placeTape(this.root, this.beds, p).map(tapeGeometry), LEAD, 'matte', false));
    }
    let changed = this.mark(balanceMm);
    for (const [what, off] of this.worn) {
      if (wanted.has(what)) continue;
      off();
      this.worn.delete(what);
      changed = true;
    }
    for (const [what, on] of wanted) {
      if (this.worn.has(what)) continue;
      this.worn.set(what, on());
      changed = true;
    }
    return changed;
  }

  private add(name: string, geometries: BufferGeometry[], color: HexColor, finish: Finish, castShadow: boolean): () => void {
    const material = new MeshStandardMaterial({ name, color, roughness: ROUGHNESS[finish], metalness: 0 });
    const meshes = geometries.map((g) => {
      const m = new Mesh(g, material);
      m.name = name;
      m.castShadow = castShadow;
      m.receiveShadow = true;
      return m;
    });
    if (meshes.length) this.root.add(...meshes);
    return () => {
      for (const m of meshes) {
        m.removeFromParent();
        m.geometry.dispose();
      }
      material.dispose();
    };
  }

  private wrap(color: HexColor): () => void {
    const grip = this.root.getObjectByName('grip') as Mesh;
    const stock = grip.material;
    const material = (grip.material = new MeshStandardMaterial({ name: 'overgrip', color, roughness: ROUGHNESS.matte, metalness: 0 }));
    return () => {
      grip.material = stock;
      material.dispose();
    };
  }

  /** Moved rather than made again: it follows every change of weight, and its shader is its own. */
  private mark(balanceMm: number | null): boolean {
    const says = balanceMm !== null && Number.isFinite(balanceMm) ? String(balanceMm) : '';
    if (says === this.balance) return false;
    this.balance = says;
    const y = Number(balanceMm) / 1000;
    const reach = says ? reachAt(this.root, y) : null;
    if (!reach) {
      if (!this.marker) return false;
      this.marker.removeFromParent();
      this.marker.geometry.dispose();
      this.marker.material.dispose();
      this.marker = null;
      return true;
    }
    this.marker ??= markerMesh();
    this.root.add(this.marker);
    this.marker.position.y = y;
    this.marker.scale.set(reach.x + MARKER_OFF, 1, reach.z + MARKER_OFF);
    return true;
  }
}

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
  /** The undressed model's box and close-ups: what it wears never moves the camera. */
  private readonly box = new Box3();
  private parts: Record<PartView, Box3> | null = null;
  private outfit: Outfit | null = null; // null for a spool: no strings
  private dressed: Dress | null = null;
  private look: Look = 'realistic';
  private home: Pose = { target: new Vector3(), offset: new Vector3(0, 0, 1) };
  private glide: { from: Pose; to: Pose; start: number; done: () => void } | null = null;
  private reveal = 0;
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
    this.alcove.reveal = this.reveal = 0;
    this.resized.disconnect();
    this.canvas.remove();
  }

  /**
   * Load and frame a model. The one on show stays until the new one is ready; with `keepView` the
   * new one takes its place at the same angle, zoom and spot on the racquet. Rejects if the file fails to load.
   */
  async show(url: string, keepView = false, { colours = {}, scale = 1 }: ShowOptions = {}): Promise<void> {
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
    this.drop();
    this.model = tinted(source, colours);
    this.model.scale.multiplyScalar(scale);
    this.box.setFromObject(this.model);
    this.parts = partBoxes(this.model);
    // Only a model with strings can be dressed, whatever colours it is shown in: before anyone sees it.
    const beds = bedLines(this.model);
    this.outfit = beds && new Outfit(this.model, beds);
    this.outfit?.wear(this.dressed);
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

  /** Dress the racquet on show, and every one after it, until told otherwise; null is stock. A spool is left alone. */
  dress(d: Dress | null): void {
    this.dressed = structuredClone(d);
    if (this.outfit?.wear(this.dressed)) this.dirty = true;
  }

  /** The racquet on show and where its own strings run. */
  get model3d(): { root: Object3D; beds: Beds } | null {
    return this.outfit && { root: this.outfit.root, beds: this.outfit.beds };
  }

  /** The point on the frame, collar or grip under the pointer, in racquet space. */
  pick(clientX: number, clientY: number): Vector3 | null {
    return this.outfit && surfaceUnder(this.outfit.root, this.rayAt(clientX, clientY));
  }

  /** The ray under the pointer, in racquet space. Null for a spool. */
  ray(clientX: number, clientY: number): Ray | null {
    if (!this.outfit) return null;
    this.outfit.root.updateWorldMatrix(true, false);
    return this.rayAt(clientX, clientY).ray.clone().applyMatrix4(this.outfit.root.matrixWorld.clone().invert());
  }

  /** Where a point of the racquet is drawn, CSS px from the canvas's top left. Null for a spool. */
  project(point: Vector3): [number, number] | null {
    if (!this.outfit) return null;
    this.outfit.root.updateWorldMatrix(true, false);
    this.camera.updateMatrixWorld();
    const p = this.outfit.root.localToWorld(point.clone()).project(this.camera);
    return [((p.x + 1) / 2) * this.canvas.clientWidth, ((1 - p.y) / 2) * this.canvas.clientHeight];
  }

  /** The whole racquet, and still: `reset` without the turning. */
  hold(): void {
    this.glideTo(this.home);
  }

  /** Draw in `look` from the next frame. */
  setLook(look: Look): void {
    this.look = look;
    this.painter.setLook(look);
    this.dirty = true;
  }

  clear(): void {
    this.request++;
    this.drop();
    this.dirty = true;
  }

  /** Take the model off the stage, with the materials made for it. */
  private drop() {
    if (!this.model) return;
    this.studio.scene.remove(this.model);
    this.outfit?.wear(null);
    this.outfit = null;
    this.parts = null;
    untint(this.model);
    this.model = null;
  }

  reset(): void {
    this.glideTo(this.home, () => (this.controls.autoRotate = !prefersReducedMotion()));
  }

  /** Move in on one part of the racquet, from the side the camera is already on. */
  focus(part: PartView): void {
    if (!this.parts) return;
    const box = this.parts[part];
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
    const ray = this.rayAt(e.clientX, e.clientY);
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

  private rayAt(clientX: number, clientY: number): Raycaster {
    const r = this.canvas.getBoundingClientRect();
    const ray = new Raycaster();
    this.camera.updateMatrixWorld();
    ray.setFromCamera(new Vector2(((clientX - r.left) / r.width) * 2 - 1, 1 - ((clientY - r.top) / r.height) * 2), this.camera);
    return ray;
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
    const center = this.box.getCenter(new Vector3());
    const yaw = -0.45;
    const pitch = 0.12;
    // Fit the whole frame with a margin, whichever of height or width is the tighter fit.
    const distance = (this.distance = fitModel(this.box, FOV, this.camera.aspect, pitch));
    c.target.copy(center);
    this.camera.position.set(
      center.x + distance * Math.sin(yaw) * Math.cos(pitch),
      center.y + distance * Math.sin(pitch),
      center.z + distance * Math.cos(yaw) * Math.cos(pitch),
    );
    c.minDistance = nearSide(this.box) + distance * 0.1; // never inside a solid model
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
    this.camera.layers[this.outfit?.marked ? 'enable' : 'disable'](MARKER_LAYER);
    const yaw = this.controls.getAzimuthalAngle();
    const there = presence(this.camera.position, this.controls.target, this.box.min.y);
    this.studio.face(yaw, 1 - there.floor);
    // The other looks draw the racquet alone, so the alcove leaves the scene; they get its light and
    // shadow as data and redraw them in their own medium.
    const realistic = this.look === 'realistic';
    if (realistic && this.model) this.studio.scene.add(this.alcove.node);
    else this.alcove.node.removeFromParent();
    if (this.model) this.alcove.update(this.renderer, this.studio.scene, this.camera, yaw, this.box.min.y, there);
    const stage = !realistic && this.model ? { data: this.alcove.asData(this.renderer, this.camera), reveal: this.reveal } : null;
    this.painter.render(this.studio.scene, this.camera, this.renderer.getPixelRatio(), LOOK_SCALE, stage);
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
      this.alcove.reveal = this.reveal = MathUtils.smoothstep(t, 0, 1);
      this.dirty = true;
      if (t === 1) this.lit = Infinity;
    }
    if (this.dirty) this.draw();
  };
}
