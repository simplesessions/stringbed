// What the build page's benches are made of: the desk they all work at, and the small controls on them.
import type { Beds } from '../../src/restring';
import type { StringSpec } from '../../src/string-spec';
import type { PlacedTape, TapePiece } from '../../src/tape';
import type { Object3D } from 'three';
import type { Build } from './build-state';
import type { Clock } from './build-timing';
import type { ChosenStrings, Figures } from './build-view';
import type { Racquet } from './catalog-view';
import { sectionCorners } from './cross-section';
import { el, icon } from './dom';

export type Loading = 'loading' | 'ready' | 'failed';

/** The page as its benches see it. Read it fresh each time: nothing on it stands still. */
export interface Desk {
  readonly base: Racquet;
  readonly build: Build;
  readonly strings: StringSpec[] | null;
  readonly stringsState: Loading;
  /** What is strung; null: stock strings. */
  readonly set: ChosenStrings;
  /** The undressed model the numbers are worked out on. */
  readonly model: { root: Object3D; beds: Beds; sideEndMm: number } | null;
  readonly figures: Figures | null;
  /** Where a piece of tape lies; [] when it does not fit. */
  lay(p: TapePiece): PlacedTape[];
  /** The one way a visitor changes the build; `what` is said before the numbers. */
  change(next: Partial<Build>, what?: string): void;
  announce(text: string): void;
  /** Sounds of the string bed, each in its time. */
  strum: { weave(): void; soon(ms: number): void };
  /** Stops when the page is left. */
  clock: Clock;
}

let ids = 0;
export const uid = (of: string) => `${of}-${++ids}`;

export interface Segmented<T> {
  node: HTMLElement;
  set(value: T): void;
}

/** A few exclusive choices in one pill. */
export function segmented<T extends string | number>(label: string, options: ReadonlyArray<{ value: T; text: string }>, choose: (v: T) => void): Segmented<T> {
  const buttons = options.map((o) => {
    const b = el('button', { class: 'seg', type: 'button' }, o.text);
    b.addEventListener('click', () => choose(o.value));
    return b;
  });
  return {
    node: el('div', { class: 'segs', role: 'group', 'aria-label': label }, ...buttons),
    set: (value) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === value))),
  };
}

/** Colours to choose from: native radios, so arrow keys and names come with them. */
export function swatches(legend: string, options: ReadonlyArray<{ id: string; name: string; hex: string | null }>, choose: (id: string) => void): { node: HTMLElement; set(id: string): void } {
  const name = uid('swatch');
  const inputs = options.map((o) => {
    const input = el('input', { class: 'sr-only', type: 'radio', name, value: o.id });
    input.addEventListener('change', () => choose(o.id));
    return input;
  });
  return {
    node: el('fieldset', { class: 'swatches' },
      el('legend', {}, legend),
      ...options.map((o, i) =>
        el('label', { class: 'swatch', style: o.hex ? `--chip: ${o.hex}` : null },
          inputs[i], el('span', { class: `swatch-chip${o.hex ? '' : ' is-none'}`, 'aria-hidden': 'true' }), el('span', { class: 'swatch-name' }, o.name)))),
    set: (id) => inputs.forEach((x) => (x.checked = x.value === id)),
  };
}

interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  text(v: number): string;
  /** Read out instead of `text`, when that is not enough. */
  says?(v: number): string;
  /** Every step of the way. */
  input(v: number): void;
  /** Let go, or a key pressed. */
  settled?(v: number): void;
}

/** A slider with a button at each end for one step, and its value beside its name. */
export function slider(o: SliderOptions): { node: HTMLElement; set(v: number): void; range(min: number, max: number): void } {
  const id = uid('slider');
  const input = el('input', { class: 'slide', type: 'range', id, min: String(o.min), max: String(o.max), step: String(o.step) });
  const output = el('span', { class: 'slider-value', 'aria-hidden': 'true' }); // the slider says it itself
  const paint = (v: number) => {
    output.textContent = o.text(v);
    input.setAttribute('aria-valuetext', (o.says ?? o.text)(v));
    input.style.setProperty('--done', `${((v - Number(input.min)) / (Number(input.max) - Number(input.min) || 1)) * 100}%`);
  };
  input.addEventListener('input', () => {
    paint(input.valueAsNumber);
    o.input(input.valueAsNumber);
  });
  input.addEventListener('change', () => o.settled?.(input.valueAsNumber));
  const nudge = (by: number, text: string, d: 'minus' | 'plus') => {
    const b = el('button', { class: 'nudge', type: 'button', 'aria-label': `${o.label}: ${text}` }, icon(d));
    b.addEventListener('click', () => {
      const v = Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber + by));
      if (v === input.valueAsNumber) return;
      input.valueAsNumber = v;
      paint(v);
      o.input(v);
      o.settled?.(v);
    });
    return b;
  };
  return {
    node: el('div', { class: 'slider' },
      el('label', { class: 'slider-label', for: id }, o.label), output,
      el('div', { class: 'slider-run' }, nudge(-o.step, 'less', 'minus'), input, nudge(o.step, 'more', 'plus'))),
    set(v) {
      if (input.valueAsNumber !== v) input.valueAsNumber = v;
      paint(v);
    },
    range(min, max) {
      input.min = String(min);
      input.max = String(max);
    },
  };
}

/** A string's own section in its colour, small: round, five sides, or a dashed ring when nobody says. */
export function sectionDot(s: StringSpec, hex: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-70 -70 140 140');
  svg.setAttribute('class', 'section-dot');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.setProperty('--swatch', hex);
  const cut = document.createElementNS(NS, s.shape?.sides ? 'polygon' : 'circle');
  if (s.shape?.sides) cut.setAttribute('points', sectionCorners(s.shape.sides, 1.2).map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' '));
  else cut.setAttribute('r', '58');
  cut.setAttribute('class', s.shape ? 'section-cut' : 'section-cut is-unknown');
  svg.append(cut);
  return svg;
}

/** One section of the page. */
export const bench = (title: string, ...nodes: Array<Node | null>) => {
  const id = uid('bench');
  return el('section', { class: 'bench', 'aria-labelledby': id }, el('h2', { class: 'bench-head', id }, title), ...nodes);
};
export const fullName = (s: StringSpec) => `${s.brand} ${s.name}`;
