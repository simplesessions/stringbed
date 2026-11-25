// The readout: weight, balance, swingweight and twist, what changed and against what, and the beam that tips.
import type { PlayRow } from '../../src/play';
import type { PlacedTape } from '../../src/tape';
import type { Build } from './build-state';
import type { Desk } from './build-parts';
import { beamPose, hexOf, moved, readoutCells, type Cell, type ChosenStrings, type Figures } from './build-view';
import type { Racquet } from './catalog-view';
import { el, icon } from './dom';

function cellView(label: string) {
  const value = el('span', { class: 'reading-value' });
  const change = el('span', { class: 'reading-change' });
  const against = el('span', { class: 'reading-against' });
  const note = el('span', { class: 'reading-note' });
  return {
    node: el('div', { class: 'reading' }, el('dt', {}, label), el('dd', {}, value, el('span', { class: 'reading-delta' }, change, ' ', against), note)),
    set(c: Cell) {
      const rough = c.value.startsWith('about ');
      value.replaceChildren(...(rough ? [el('span', { class: 'reading-about' }, 'about ')] : []), rough ? c.value.slice(6) : c.value);
      value.classList.toggle('is-missing', /^Not /.test(c.value));
      change.textContent = c.change;
      change.classList.toggle('is-still', c.change === 'no change');
      against.textContent = c.against;
      note.textContent = c.note;
    },
  };
}

/** `state`: how the model the numbers are worked out on is doing; `retry`: fetch it again. */
export function readout(desk: Desk, retry: () => void): { node: HTMLElement; sync(state: 'loading' | 'ready' | 'failed' | 'none', rows: PlayRow[]): void } {
  const beam = beamView(desk.base);
  const cells = { weight: cellView('Weight'), balance: cellView('Balance'), swingweight: cellView('Swingweight'), twist: cellView('Twist added') };
  const again = el('button', { class: 'button', type: 'button' }, icon('retry'), 'Try again');
  again.addEventListener('click', retry);
  const word = el('span');
  const fault = el('p', { class: 'reading-fault', hidden: true }, word, again);
  const plays = el('p', { class: 'reading-moved' });
  return {
    node: el('section', { class: 'readings', 'aria-label': 'Weight, balance and swingweight' },
      beam.node, fault, el('dl', { class: 'reading-cells' }, ...Object.values(cells).map((c) => c.node)), plays),
    sync(state, rows) {
      const working = state === 'loading';
      fault.hidden = state === 'ready' || working;
      again.hidden = state !== 'failed';
      word.textContent = state === 'failed' ? 'The model did not load, so weight and balance cannot be worked out, and the estimate leaves them out.' : 'Weight and balance need the model’s geometry, which could not be read here. The estimate leaves them out.';
      const c = desk.figures && readoutCells(desk.figures);
      const blank: Cell = { value: working ? '…' : '–', change: '', against: '', note: '' };
      for (const k of ['weight', 'balance', 'swingweight', 'twist'] as const) cells[k].set(c ? c[k] : blank);
      const line = moved(rows);
      plays.textContent = line ? `Plays: ${line}` : 'Plays as it comes';
      beam.set(desk.figures, desk.build, desk.set, desk.build.tape.flatMap(desk.lay));
    },
  };
}

/** A racquet laid across its own middle: it tips the way its balance does, and wears what is put on it. */
function beamView(r: Racquet) {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag: string, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const lengthMm = r.specs.lengthIn * 25.4;
  const LEFT = 20;
  const SPAN = 360;
  const AXIS = 34;
  /** It lies across the foot, so its face is seen from low down. */
  const FLAT = 0.4;
  const px = SPAN / lengthMm;
  const size = Math.sqrt(r.specs.headSizeSqIn / 100) * 25.4;
  const [headLong, headWide] = [13 * size, 10.2 * size];
  const at = (mm: number) => LEFT + mm * px;
  const cx = at(lengthMm - headLong / 2);
  const throat = at(lengthMm - headLong);
  const gripEnd = at(178 + (lengthMm - 685.8) / 2);
  const hoop = make('ellipse', { class: 'beam-hoop', cx, cy: AXIS, rx: (headLong / 2) * px, ry: (headWide / 2) * px * FLAT });
  const arms = make('path', { class: 'beam-hoop', d: `M${throat + 8} ${AXIS - 8}L${gripEnd + 26} ${AXIS - 1}M${throat + 8} ${AXIS + 8}L${gripEnd + 26} ${AXIS + 1}` });
  const shaft = make('path', { class: 'beam-hoop', d: `M${gripEnd + 28} ${AXIS}H${gripEnd}` });
  const handle = make('rect', { class: 'beam-grip', x: LEFT, y: AXIS - 4, width: gripEnd - LEFT, height: 8, rx: 2 });
  const lead = make('g', { class: 'beam-lead' });
  const dot = make('circle', { class: 'beam-dot', cy: AXIS, r: 4.5 });
  const racquet = make('g', { class: 'beam-racquet' });
  racquet.append(arms, shaft, hoop, handle, lead, dot);
  const svg = make('svg', { class: 'beam', viewBox: '0 0 400 76', role: 'img' });
  svg.append(make('path', { class: 'beam-foot', d: 'M200 36l10 32h-20zM120 69h160' }), racquet);
  return {
    node: svg,
    set(f: Figures | null, b: Build, set: ChosenStrings, laid: PlacedTape[]) {
      const points = f?.balance.points ?? null;
      const pose = beamPose(points, f?.balance.value ?? null, lengthMm);
      (racquet as SVGGElement).style.setProperty('--tilt', `${pose.tilt}deg`);
      dot.toggleAttribute('hidden', pose.dot === null);
      if (pose.dot !== null) dot.setAttribute('cx', at(pose.dot * lengthMm).toFixed(1));
      hoop.setAttribute('style', set ? `--bed: ${set.mains.colour.hex}` : '');
      handle.setAttribute('style', b.overgrip ? `--grip: ${hexOf(b.overgrip)}` : '');
      lead.replaceChildren(...laid.map((t) => make('polyline', { points: t.path.map((p) => `${at(p.y * 1000).toFixed(1)},${(AXIS + p.x * 1000 * px * FLAT).toFixed(1)}`).join(' ') })));
      svg.setAttribute('aria-label', points === null ? 'Balance beam: the balance is not known' : `Balance beam: ${readoutCells(f!).balance.note}`);
    },
  };
}
