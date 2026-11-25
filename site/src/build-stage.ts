// Sticking lead tape onto the model: aim at the frame, press, let go. A mouse, a finger and the
// arrow keys all do it. Only one finger on the frame is ours; everything else, two fingers above all,
// still belongs to the camera. What the hand does is worked out in tape-hand.ts; this is the pointers,
// the marks over the model and the words beside the pointer.
import type { Vector3 } from 'three';
import type { Beds } from '../../src/restring';
import type { PlacedTape, TapePiece } from '../../src/tape';
import type { Clock } from './build-timing';
import { NEW_PIECE, gramsOf, nearestPiece, onBed, snapped, tapeName, type Place } from './build-view';
import { el, polylines } from './dom';
import { aimNext, hand, newHand, ringSearch, type Effect, type HandEvent, type Spot } from './tape-hand';
import type { Viewer } from './viewer';

export interface TapeHost {
  viewer: Viewer;
  /** The stage's own element: focus and keys are its. */
  stage: HTMLElement;
  tapeAt(hit: Vector3): Place;
  model(): { beds: Beds; sideEndMm: number } | null;
  tape(): TapePiece[];
  lay(p: TapePiece): PlacedTape[];
  lengthIn: number;
  /** Whether a new piece goes on both sides. */
  both(): boolean;
  /** Show where a piece would go; null: nowhere. */
  aim(p: TapePiece | null): void;
  stick(p: TapePiece): void;
  /** A piece is being moved; `done` when it is let go. */
  move(index: number, place: Place, done: boolean): void;
  grabbed(index: number): void;
  /** The piece being changed in the list; -1: none. */
  selected(): number;
  tapBed(): void;
  onMode(on: boolean): void;
  say(text: string): void;
  clock: Clock;
  signal: AbortSignal;
}
export interface TapeTool {
  readonly on: boolean;
  setMode(on: boolean): void;
  /** Put the tape away and let go of whatever is held, without touching the build: it is about to be another. */
  forget(): void;
  /** Something the marks over the model show may have changed. */
  wake(): void;
}

/** How far from the frame a press counts, CSS px, and how far one that is moving a piece may stray. */
const REACH = { mouse: 9, touch: 24, moving: 44 };
/** How near a press must be to a piece to take hold of it, metres. */
const GRAB = 0.011;
const NO_ROOM = 'No room for it here';

export function tapeTool(o: TapeHost): TapeTool {
  const { viewer, stage, signal, clock } = o;
  const { canvas } = viewer;
  const niche = stage.querySelector<HTMLElement>('.niche')!;
  let state = newHand();
  let aimed: TapePiece | null = null;
  let keyed: Place = { zone: 'h', at: 0 };
  /** A pointer event of our own on its way to the camera. */
  let passing = false;

  const bar = el('div', { class: 'tape-bar', hidden: true },
    el('p', {},
      el('span', { class: 'hint-fine' }, 'Click the frame to stick lead on it; drag a piece to move it. Or the arrow keys, then Enter.'),
      el('span', { class: 'hint-coarse' }, 'Touch the frame, slide to aim, let go to stick. Two fingers move the view.')));
  const chip = el('div', { class: 'tape-chip', hidden: true, 'aria-hidden': 'true' });
  const marks = polylines('tape-marks');
  niche.append(marks.node, chip);
  stage.querySelector('.stage-controls')!.append(bar);

  // ---------- what is under a point ----------

  const fresh = (place: Place): TapePiece => ({ ...place, ...NEW_PIECE, mirrored: o.both() });
  const fits = (p: TapePiece) => o.lay(p).length > 0;
  const frameAt = (x: number, y: number, reach: number) => ringSearch((px, py) => viewer.pick(px, py), x, y, reach);
  const grabAt = (hit: Vector3) => nearestPiece(o.tape().map(o.lay), hit, GRAB);
  const reachOf = (pointer: string) => (pointer === 'mouse' ? REACH.mouse : REACH.touch);

  function spotAt(hit: Vector3, held: TapePiece | null): Spot {
    const place = snapped(o.tapeAt(hit));
    const piece = held ? { ...held, ...place } : fresh(place);
    return { piece, fits: fits(piece) };
  }

  /** Whether this spot of the canvas is open string bed, with no frame in front of it. */
  function overBed(x: number, y: number): boolean {
    const m = viewer.model3d;
    const ray = m && viewer.ray(x, y);
    if (!ray || viewer.pick(x, y)) return false;
    const t = (m.beds.mains.z - ray.origin.z) / ray.direction.z;
    return t > 0 && onBed(m.beds, ray.origin.x + t * ray.direction.x, ray.origin.y + t * ray.direction.y);
  }

  // ---------- what is shown ----------

  function say(x: number, y: number, text: string) {
    const r = niche.getBoundingClientRect();
    chip.hidden = false;
    chip.textContent = text;
    chip.classList.toggle('is-left', x - r.left > r.width * 0.6); // towards the middle, never off the edge
    chip.style.translate = `${(x - r.left).toFixed(0)}px ${(y - r.top).toFixed(0)}px`;
  }
  const wordsFor = (p: TapePiece) => `${tapeName(p, o.lengthIn)} · ${gramsOf(p).toFixed(1)} g`;
  const sayOf = (x: number, y: number, spot: Spot | null) => {
    if (spot) say(x, y, spot.fits ? wordsFor(spot.piece) : NO_ROOM);
    else chip.hidden = true;
  };
  function aim(p: TapePiece | null) {
    aimed = p;
    o.aim(p);
    wake();
  }

  // Lead is thin and lies on the inner wall of the hoop, nearly edge-on from the front. Outlines drawn
  // over the model say where it is, and where the next piece would go. Frames are asked for only while
  // there are any: the camera may move under them.
  let marksOf = '';
  let off: (() => void) | null = null;
  function wake() {
    off ??= clock.frame(drawMarks);
  }
  function drawMarks() {
    off = null;
    const tape = o.tape();
    const chosen = o.selected();
    const kindOf = (i: number) => (i === (state.held ? state.held.index : chosen) ? 'is-chosen' : '');
    const wanted = [
      ...tape.flatMap((p, i) => (state.taping || i === chosen ? [{ p, kind: kindOf(i) }] : [])),
      ...(aimed ? [{ p: aimed, kind: 'is-aim' }] : []),
    ];
    const lines = wanted.flatMap(({ p, kind }) => o.lay(p).map(({ path }) => ({ kind, path })));
    const says = lines.map(({ kind, path }) => [kind, path.length, viewer.project(path[0]), viewer.project(path[path.length - 1])].join()).join(' ');
    if (says !== marksOf) {
      marksOf = says;
      marks.set(lines.map(({ kind, path }) => ({ kind, points: path.flatMap((q) => [viewer.project(q) ?? []].filter((xy): xy is [number, number] => xy.length === 2)) })));
    }
    if (wanted.length) wake();
  }

  // ---------- the hand ----------

  function act(event: HandEvent): Effect[] {
    const { state: next, effects } = hand(state, event);
    state = next;
    for (const e of effects) {
      if (e.do === 'aim') aim(e.piece);
      else if (e.do === 'grab') o.grabbed(e.index);
      else if (e.do === 'move') o.move(e.index, e.place, e.done);
      else if (e.do === 'stick') o.stick(e.piece);
      else if (e.do === 'handOver') handOver(e.id, e.x, e.y);
      else if (e.do === 'tap' && overBed(e.x, e.y)) o.tapBed();
    }
    if (!state.held) chip.hidden = true;
    wake();
    return effects;
  }

  /** Both fingers are the camera's. It never saw the first go down, so tell it before the second gets there. */
  function handOver(id: number, x: number, y: number) {
    passing = true;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
    passing = false;
  }

  /** The pointer is here now: slide what is held, or say what a press would do. */
  function follow(x: number, y: number, pointer: string) {
    const { held } = state;
    if (held) {
      const moving = held.index >= 0;
      const hit = frameAt(x, y, moving ? REACH.moving : reachOf(pointer));
      const spot = hit && spotAt(hit, moving ? held.piece : null);
      // A piece held by its mirror is said as the piece, not as the side the finger is on.
      act({ type: 'slide', id: held.id, spot, x, y });
      if (moving && !spot) return; // it stays where it last was, and so do the words
      return sayOf(x, y, spot && { piece: moving && spot.fits ? state.held!.piece! : spot.piece, fits: spot.fits });
    }
    const hit = frameAt(x, y, reachOf(pointer));
    const grab = hit && grabAt(hit);
    canvas.style.cursor = !hit ? '' : grab && pointer === 'mouse' ? 'move' : 'crosshair';
    const spot = hit && !grab ? spotAt(hit, null) : null;
    aim(spot?.fits ? spot.piece : null);
    if (grab) say(x, y, 'Drag to move');
    else sayOf(x, y, spot);
  }

  // ---------- pointers ----------

  let pending: PointerEvent | null = null;
  let frame: (() => void) | null = null;
  const catchUp = () => {
    frame?.();
    frame = null;
    if (pending && state.taping) follow(pending.clientX, pending.clientY, pending.pointerType);
    pending = null;
  };

  stage.addEventListener('pointerdown', (e) => {
    if (passing || e.target !== canvas) return;
    const { clientX: x, clientY: y, pointerType: pointer } = e;
    const hit = state.taping && e.button === 0 && !state.down.length && o.model() ? frameAt(x, y, reachOf(pointer)) : null;
    const taken = hit && grabAt(hit);
    const grab = taken && { ...taken, piece: o.tape()[taken.index] };
    const spot = hit && !grab ? spotAt(hit, null) : null;
    const effects = act({ type: 'down', id: e.pointerId, pointer, button: e.button, x, y, at: e.timeStamp, on: hit && { grab, spot } });
    if (!effects.some((f) => f.do === 'claim')) return; // the wall and the strings turn the racquet, as ever
    e.stopPropagation();
    stage.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    if (grab) say(x, y, wordsFor(grab.piece));
    else sayOf(x, y, spot);
  }, { capture: true, signal });

  stage.addEventListener('pointermove', (e) => {
    if (!state.taping) return;
    if (state.held?.id === e.pointerId) act({ type: 'at', id: e.pointerId, x: e.clientX, y: e.clientY });
    else if (state.held || e.pointerType !== 'mouse' || e.buttons !== 0 || e.target !== canvas) return;
    pending = e;
    frame ??= clock.frame(() => {
      frame = null;
      catchUp();
    });
  }, { signal });
  canvas.addEventListener('pointerleave', () => {
    if (!state.taping || state.held) return;
    pending = null;
    chip.hidden = true;
    aim(null);
  }, { signal });

  window.addEventListener('pointerup', (e) => {
    if (state.held?.id === e.pointerId) catchUp();
    act({ type: 'up', id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, onModel: e.target === canvas });
  }, { signal });
  window.addEventListener('pointercancel', (e) => void act({ type: 'cancel', id: e.pointerId }), { signal });

  // While tape is out, a double click is two presses, and Reset must not set the racquet turning.
  stage.addEventListener('dblclick', (e) => {
    if (state.taping && e.target === canvas) e.stopPropagation();
  }, { capture: true, signal });
  stage.addEventListener('click', (e) => {
    if (!state.taping || !(e.target as Element).closest('.stage-controls .button-quiet')) return;
    e.stopPropagation();
    viewer.hold();
  }, { capture: true, signal });

  // ---------- keys ----------

  stage.addEventListener('keydown', (e) => {
    const m = o.model();
    if (!state.taping || !m || e.target !== stage || e.metaKey || e.ctrlKey || e.altKey) return;
    const sticks = e.key === 'Enter' || e.key === ' ';
    if (!sticks && !e.key.startsWith('Arrow')) return; // + and - still zoom
    e.preventDefault();
    e.stopPropagation();
    if (sticks) {
      if (e.repeat) return;
      const p = fresh(keyed);
      if (!fits(p)) return o.say(NO_ROOM);
      aim(null);
      o.stick(p);
      return;
    }
    const next = aimNext(keyed, e.key, e.shiftKey, m.sideEndMm, (place) => fits(fresh(place)));
    if (!next) return o.say(NO_ROOM);
    keyed = next;
    aim(fresh(keyed));
    o.say(tapeName(fresh(keyed), o.lengthIn));
  }, { capture: true, signal });

  window.addEventListener('keydown', (e) => {
    if (!state.taping || e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    e.preventDefault(); // put the tape away, not the page
    if (state.held) act({ type: 'drop' });
    else setMode(false);
  }, { capture: true, signal });

  // ---------- mode ----------

  /** Everything but the hand. */
  function show(on: boolean) {
    pending = null;
    aim(null);
    chip.hidden = true;
    bar.hidden = !on;
    stage.classList.toggle('is-taping', on);
    canvas.style.touchAction = on ? 'none' : 'pan-y'; // a finger on the frame must not scroll the page
    canvas.style.cursor = '';
    if (on) viewer.hold(); // the whole racquet, held still: aiming at something that turns is no fun
    o.onMode(on);
    if (on) stage.focus({ preventScroll: true });
  }
  function setMode(on: boolean) {
    if (on === state.taping) return;
    act({ type: 'drop' });
    act({ type: 'mode', on });
    show(on);
  }
  signal.addEventListener('abort', () => {
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = '';
  });

  return {
    get on() {
      return state.taping;
    },
    setMode,
    forget() {
      const was = state.taping;
      act({ type: 'forget' });
      if (was) show(false);
    },
    wake,
  };
}
