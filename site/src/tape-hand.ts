// What a hand does to tape on the model, apart from any pointer, screen or model: press and slide to
// aim, let go to stick, take hold of a piece and move it, a second finger for the camera, a tap. Events
// in, the next state and what to do about it out. build-stage.ts turns the one into the other.
import type { TapePiece } from '../../src/tape';
import { aimStep, mirrored, type Place } from './build-view';

/** A press that moves less than this, for less than this long, is a tap. */
const TAP_PX = 6;
const TAP_MS = 450;

/** The frame under a press: the piece that would go there, and whether there is room for it. */
export interface Spot {
  piece: TapePiece;
  fits: boolean;
}
export interface Held {
  id: number;
  pointer: string;
  /** Where the finger is now, for the camera if it takes over. */
  x: number;
  y: number;
  /** The piece being moved; -1: a new one. `side` 1 is its mirror. */
  index: number;
  side: number;
  was: Place;
  /** As it stands now. A new one is null off the frame or where there is no room: let go there, nothing sticks. */
  piece: TapePiece | null;
}
export interface Hand {
  taping: boolean;
  /** Fingers and buttons down on the model. */
  down: readonly number[];
  tap: { id: number; x: number; y: number; at: number } | null;
  held: Held | null;
}
export const newHand = (): Hand => ({ taping: false, down: [], tap: null, held: null });

export type HandEvent =
  | { type: 'down'; id: number; pointer: string; button: number; x: number; y: number; at: number; on: { grab: { index: number; side: number; piece: TapePiece } | null; spot: Spot | null } | null }
  /** Where a finger is: every move. */
  | { type: 'at'; id: number; x: number; y: number }
  /** What is under it: once a frame. */
  | { type: 'slide'; id: number; spot: Spot | null; x?: number; y?: number }
  | { type: 'up'; id: number; x: number; y: number; at: number; onModel: boolean }
  | { type: 'cancel'; id: number }
  /** Put back what is held. */
  | { type: 'drop' }
  /** Let go of what is held without touching it: the build it was in is gone. */
  | { type: 'forget' }
  | { type: 'mode'; on: boolean };

export type Effect =
  /** This press is ours: the camera must not see it. */
  | { do: 'claim'; id: number }
  | { do: 'aim'; piece: TapePiece | null }
  | { do: 'grab'; index: number }
  | { do: 'move'; index: number; place: Place; done: boolean }
  | { do: 'stick'; piece: TapePiece }
  | { do: 'tap'; x: number; y: number }
  /** Both fingers are the camera's, which never saw this one go down. */
  | { do: 'handOver'; id: number; x: number; y: number };

const at = ({ zone, at }: Place): Place => ({ zone, at });
const moved = (h: Held) => h.piece !== null && (h.piece.at !== h.was.at || h.piece.zone !== h.was.zone);
const release = (h: Held): Effect[] => [{ do: 'aim', piece: null }, ...(h.index >= 0 && moved(h) ? [{ do: 'move' as const, index: h.index, place: h.was, done: false }] : [])];

export function hand(s: Hand, e: HandEvent): { state: Hand; effects: Effect[] } {
  const { held } = s;
  switch (e.type) {
    case 'down': {
      const down = [...s.down.filter((id) => id !== e.id), e.id];
      if (down.length > 1) {
        const effects: Effect[] = held ? [...release(held), ...(held.pointer === 'touch' && e.pointer === 'touch' ? [{ do: 'handOver' as const, id: held.id, x: held.x, y: held.y }] : [])] : [];
        return { state: { ...s, down, tap: null, held: null }, effects };
      }
      const mine = s.taping && e.button === 0 ? e.on : null;
      if (!mine) return { state: { ...s, down, tap: e.button === 0 ? { id: e.id, x: e.x, y: e.y, at: e.at } : null }, effects: [] };
      const press = { id: e.id, pointer: e.pointer, x: e.x, y: e.y };
      if (mine.grab) {
        const { index, side, piece } = mine.grab;
        return { state: { ...s, down, tap: null, held: { ...press, index, side, was: at(piece), piece } }, effects: [{ do: 'claim', id: e.id }, { do: 'aim', piece: null }, { do: 'grab', index }] };
      }
      const piece = mine.spot?.fits ? mine.spot.piece : null;
      const was = at(mine.spot?.piece ?? { zone: 'h', at: 0 });
      return { state: { ...s, down, tap: null, held: { ...press, index: -1, side: 0, was, piece } }, effects: [{ do: 'claim', id: e.id }, { do: 'aim', piece }] };
    }
    case 'at':
      return { state: held?.id === e.id ? { ...s, held: { ...held, x: e.x, y: e.y } } : s, effects: [] };
    case 'slide': {
      if (held?.id !== e.id) return { state: s, effects: [] };
      const place = { x: e.x ?? held.x, y: e.y ?? held.y };
      if (held.index < 0) {
        const piece = e.spot?.fits ? e.spot.piece : null;
        return { state: { ...s, held: { ...held, ...place, piece } }, effects: [{ do: 'aim', piece }] };
      }
      if (!e.spot?.fits) return { state: { ...s, held: { ...held, ...place } }, effects: [] }; // it stays where it last was
      const to = held.side ? mirrored(e.spot.piece) : at(e.spot.piece);
      return { state: { ...s, held: { ...held, ...place, piece: { ...held.piece!, ...to } } }, effects: [{ do: 'move', index: held.index, place: to, done: false }] };
    }
    case 'up': {
      const state = { ...s, down: s.down.filter((id) => id !== e.id), tap: s.tap?.id === e.id ? null : s.tap, held: held?.id === e.id ? null : held };
      if (held?.id === e.id) {
        if (held.index >= 0) return { state, effects: moved(held) ? [{ do: 'move', index: held.index, place: at(held.piece!), done: true }] : [] };
        return { state, effects: held.piece ? [{ do: 'aim', piece: null }, { do: 'stick', piece: held.piece }] : [] };
      }
      const tap = s.tap?.id === e.id && e.onModel && Math.hypot(e.x - s.tap.x, e.y - s.tap.y) < TAP_PX && e.at - s.tap.at < TAP_MS;
      return { state, effects: tap ? [{ do: 'tap', x: e.x, y: e.y }] : [] };
    }
    case 'cancel':
      return {
        state: { ...s, down: s.down.filter((id) => id !== e.id), tap: s.tap?.id === e.id ? null : s.tap, held: held?.id === e.id ? null : held },
        effects: held?.id === e.id ? release(held) : [],
      };
    case 'drop':
      return { state: { ...s, held: null }, effects: held ? release(held) : [] };
    case 'forget':
      return { state: { ...s, taping: false, tap: null, held: null }, effects: held ? [{ do: 'aim', piece: null }] : [] };
    case 'mode':
      return { state: { ...s, taping: e.on }, effects: [] };
  }
}

/** The first thing found at a point or, ring by ring, around it. The frame is a few pixels wide on a phone, so a press counts some way off. */
export function ringSearch<T>(find: (x: number, y: number) => T | null, x: number, y: number, reach: number): T | null {
  const here = find(x, y);
  if (here !== null) return here;
  for (let r = 4; r <= reach; r += 5) {
    for (let a = 0; a < 8; a++) {
      const near = find(x + r * Math.cos((a * Math.PI) / 4), y + r * Math.sin((a * Math.PI) / 4));
      if (near !== null) return near;
    }
  }
  return null;
}

/** Where an arrow key aims: a step on, or over a stretch with no room to the next that has some. Null: nowhere that way. */
export function aimNext(from: Place, key: string, fine: boolean, sideEndMm: number, fits: (p: Place) => boolean): Place | null {
  let place = from;
  for (let i = 0; i < 30; i++) {
    const next = aimStep(place, key, fine, sideEndMm);
    if (!next) return null;
    if (fits(next)) return next;
    if (next.zone === place.zone && next.at === place.at) return null; // the end of the arm
    place = next;
  }
  return null;
}
