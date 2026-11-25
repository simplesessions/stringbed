// The lead bench: presets, and a list in which every piece can be placed, sized, layered and taken off.
import { TAPE_G_PER_INCH } from '../../src/mass';
import type { TapePiece } from '../../src/tape';
import { bench, segmented, slider, uid, type Desk } from './build-parts';
import { MAX_TAPE, PRESETS, addPiece, gramsOf, presetPiece, tapeName } from './build-view';
import { el, icon } from './dom';
import { play } from './sound';

/** The thumb presses the tape down when it is off its backing. */
const PRESS_AFTER = 300;
/** About where a full-size racquet's arms meet the hoop, until the model says. */
const ARMS_MM = 330;
const REFUSED = { layers: 'That piece has four layers already.', full: `${MAX_TAPE} pieces is the most.` };

export interface LeadBench {
  node: HTMLElement;
  sync(): void;
  /** Stick a piece on. */
  stick(p: TapePiece): void;
  put(index: number, patch: Partial<TapePiece>): void;
  /** Open one piece in the list, and only that one. */
  open(index: number): void;
  /** The piece open in the list; -1: none. */
  opened(): number;
}

interface PieceView {
  node: HTMLElement;
  open(yes: boolean): void;
  isOpen(): boolean;
  sync(p: TapePiece): void;
  remove: HTMLButtonElement;
}

/** `way`: the button that takes the tape out on the model, if there is one. */
export function leadBench(desk: Desk, way: HTMLElement | null, changed: () => void): LeadBench {
  const { lengthIn } = desk.base.specs;
  const sideEnd = () => desk.model?.sideEndMm ?? ARMS_MM;
  const presets = el('div', { class: 'presets', role: 'group', 'aria-label': 'Stick lead at' },
    ...PRESETS.map((p) => {
      const b = el('button', { class: 'chip-button', type: 'button' }, p.label);
      b.addEventListener('click', () => stick(presetPiece(p.id, sideEnd(), lengthIn)));
      return b;
    }));
  const list = el('ul', { class: 'pieces', role: 'list', 'aria-label': 'Lead tape' });
  const total = el('p', { class: 'bench-note' });
  const pieces: PieceView[] = [];

  function stick(p: TapePiece) {
    const { tape, index, result } = addPiece(desk.build.tape, p);
    if (result === 'full' || result === 'layers') {
      total.textContent = REFUSED[result];
      desk.announce(REFUSED[result]);
      return;
    }
    play('peel');
    desk.clock.later(() => play('press'), PRESS_AFTER);
    const name = tapeName(tape[index], lengthIn);
    desk.change({ tape }, result === 'layered' ? `${name}, ${tape[index].layers} layers.` : `Lead added, ${name}.`);
    open(index);
  }
  function put(i: number, patch: Partial<TapePiece>) {
    desk.change({ tape: desk.build.tape.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  }
  function open(i: number) {
    pieces.forEach((v, j) => v.open(i === j));
    changed();
  }

  function pieceView(): PieceView {
    const at = () => pieces.indexOf(view);
    const it = () => desk.build.tape[at()];
    const set = (patch: Partial<TapePiece>) => put(at(), patch);
    const body = el('div', { class: 'piece-body', id: uid('piece'), hidden: true });
    const name = el('span', { class: 'piece-name' });
    const meta = el('span', { class: 'piece-meta' });
    const head = el('button', { class: 'piece-open', type: 'button', 'aria-expanded': 'false', 'aria-controls': body.id }, name, meta);
    const remove = el('button', { class: 'piece-remove', type: 'button' }, icon('close'));
    const fault = el('p', { class: 'piece-fault', hidden: true }, 'It does not fit here, so it is not on the racquet and not counted.');
    const place = segmented<TapePiece['zone']>('Where', [{ value: 'h', text: 'Hoop' }, { value: 'l', text: 'Left side' }, { value: 'r', text: 'Right side' }], (zone) => {
      const p = it();
      if (p.zone === zone) return;
      set({ zone, at: zone === 'h' ? (p.zone === 'l' ? 270 : 90) : p.zone === 'h' ? sideEnd() - 50 : p.at });
    });
    const press = () => play('press');
    const position = slider({ label: 'Place', min: 0, max: 359, step: 1, text: (v) => (it()?.zone === 'h' ? `${v}°` : `${v} mm up`), says: (v) => tapeName({ ...it(), at: v }, lengthIn), input: (v) => set({ at: v }), settled: press });
    const length = slider({ label: 'Length', min: 10, max: 300, step: 5, text: (v) => `${v} mm`, input: (v) => set({ lengthMm: v }), settled: press });
    const layers = segmented<number>('Layers', [1, 2, 3, 4].map((n) => ({ value: n, text: String(n) })), (n) => {
      if (it().layers === n) return;
      set({ layers: n });
      press();
    });
    const both = el('input', { type: 'checkbox' });
    both.addEventListener('change', () => {
      set({ mirrored: both.checked });
      press();
    });
    body.append(
      el('div', { class: 'field-row' }, el('span', { class: 'field-label', 'aria-hidden': 'true' }, 'Where'), place.node), position.node, length.node,
      el('div', { class: 'field-row' }, el('span', { class: 'field-label', 'aria-hidden': 'true' }, 'Layers'), layers.node),
      el('label', { class: 'check' }, both, 'Both sides'));
    head.addEventListener('click', () => open(body.hidden ? at() : -1));
    remove.addEventListener('click', () => {
      const i = at();
      const gone = tapeName(it(), lengthIn);
      view.node.remove();
      pieces.splice(i, 1);
      desk.change({ tape: desk.build.tape.filter((_, j) => j !== i) }, `Lead removed, ${gone}.`);
      play('peel');
      const next = pieces[Math.min(i, pieces.length - 1)]?.remove ?? presets.querySelector('button');
      next?.focus({ preventScroll: true });
    });
    const view: PieceView = {
      node: el('li', { class: 'piece' }, el('div', { class: 'piece-head' }, head, remove), fault, body),
      remove,
      open(yes) {
        body.hidden = !yes;
        head.setAttribute('aria-expanded', String(yes));
      },
      isOpen: () => !body.hidden,
      sync(p) {
        name.textContent = tapeName(p, lengthIn);
        meta.textContent = `${p.lengthMm} mm${p.layers > 1 ? ` × ${p.layers}` : ''} · ${gramsOf(p).toFixed(1)} g`;
        remove.setAttribute('aria-label', `Remove lead, ${name.textContent}`);
        fault.hidden = !desk.model || desk.lay(p).length > 0;
        place.set(p.zone);
        position.range(0, p.zone === 'h' ? 359 : Math.max(p.at, sideEnd()));
        position.set(p.at);
        length.set(p.lengthMm);
        layers.set(p.layers);
        both.checked = p.mirrored;
      },
    };
    return view;
  }

  return {
    node: bench('Lead tape', el('div', { class: 'lead-ways' }, way, presets), total, list),
    stick,
    put,
    open,
    opened: () => pieces.findIndex((v) => v.isOpen()),
    sync() {
      const { tape } = desk.build;
      while (pieces.length > tape.length) pieces.pop()!.node.remove();
      while (pieces.length < tape.length) {
        const v = pieceView();
        pieces.push(v);
        list.append(v.node);
      }
      pieces.forEach((v, i) => v.sync(tape[i]));
      const g = tape.filter((p) => !desk.model || desk.lay(p).length).reduce((sum, p) => sum + gramsOf(p), 0);
      total.textContent = tape.length
        ? `${tape.length} ${tape.length === 1 ? 'piece' : 'pieces'}, ${g.toFixed(1)} g in all. ¼ in tape, ${TAPE_G_PER_INCH} g an inch.`
        : 'None on. A preset sticks 80 mm of ¼ in tape; change it below once it is on.';
    },
  };
}
