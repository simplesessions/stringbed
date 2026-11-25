// What it does: the sentences, and the racquet's ratings with the new mark and why.
import { PLAY_KEYS, type PlayRow } from '../../src/play';
import { PLAY_LABEL, moveOf, shiftText, type ratingsWord } from './build-view';
import { el, icon } from './dom';

const ESTIMATE = 'Our estimate from the ratings and your settings. Not a measurement.';

/** `retry`: fetch the ratings again. */
export function doesSection(retry: () => void): { node: HTMLElement; sync(rows: PlayRow[], sentences: string[], word: ReturnType<typeof ratingsWord>, known: boolean): void } {
  const said = el('div', { class: 'verdict' });
  const notes = el('div', { class: 'does-notes' });
  const again = el('button', { class: 'button', type: 'button', hidden: true }, icon('retry'), 'Try again');
  again.addEventListener('click', retry);
  const head = el('h3', { class: 'ratings-head' });
  const views = new Map(PLAY_KEYS.map((key) => [key, playRow(PLAY_LABEL[key])] as const));
  return {
    node: el('section', { class: 'build-does', 'aria-labelledby': 'does-head' },
      el('h2', { class: 'bench-head', id: 'does-head' }, 'What it does'), said, notes, again, head,
      el('dl', { class: 'ratings estimate' }, ...[...views.values()].map((v) => v.node)), el('p', { class: 'ratings-foot' }, ESTIMATE)),
    sync(rows, sentences, word, known) {
      said.replaceChildren(...sentences.map((s) => el('p', {}, s)));
      notes.replaceChildren(...word.notes.map((n) => el('p', { class: 'bench-note' }, n)));
      again.hidden = !word.retry;
      head.textContent = word.head;
      head.hidden = !word.head;
      for (const [key, v] of views) {
        const r = rows.find((x) => x.key === key);
        v.node.hidden = !r;
        if (r) v.set(r, known);
      }
    },
  };
}

/** One rating: five pips for the racquet as it comes, a ring for the build, and why it moved. Without a rating, an arrow. */
function playRow(label: string) {
  const ring = el('span', { class: 'ring' });
  const pips = [1, 2, 3, 4, 5].map((n) => el('span', { class: 'pip', style: `--n: ${n}` }));
  const scale = el('span', { class: 'pips', 'aria-hidden': 'true' }, ...pips, ring);
  const arrow = el('span', { class: 'shift-arrow', 'aria-hidden': 'true' }, icon('rise'));
  const value = el('span', { class: 'rating-n', 'aria-hidden': 'true' });
  const delta = el('span', { class: 'delta', 'aria-hidden': 'true' });
  const says = el('span', { class: 'sr-only' });
  const why = el('dd', { class: 'reasons' });
  const node = el('div', { class: 'rating is-comparing' }, el('dt', {}, label), el('dd', {}, scale, arrow, value, delta, says), why);
  return {
    node,
    set(r: PlayRow, known: boolean) {
      const { base, value: v, reasons } = r;
      const shift = moveOf(r);
      const still = Math.abs(shift) < 0.05;
      const dir = still ? 'same' : shift > 0 ? 'up' : 'down';
      node.classList.toggle('is-bare', base === null);
      node.dataset.dir = dir;
      pips.forEach((p, i) => p.classList.toggle('on', base !== null && i < Math.round(base)));
      ring.style.setProperty('--at', String(v ?? 3));
      ring.dataset.same = String(still);
      value.textContent = v === null ? '' : v.toFixed(1).replace('.0', '');
      delta.textContent = still ? '=' : shiftText(shift);
      delta.dataset.dir = dir;
      const moves = still ? 'no change' : `${shift > 0 ? 'up' : 'down'} ${Math.abs(shift).toFixed(1)}`;
      says.textContent = known ? (v === null ? moves : `${v.toFixed(1)} out of 5, ${moves}`) : '';
      why.replaceChildren(...reasons.map((r) => el('span', { class: 'reason' }, `${shiftText(r.shift)} ${r.text}`)));
    },
  };
}
