// What it does: the sentences, and the ratings the build moves. The rest of them, and why, are a press away.
import { PLAY_KEYS, type PlayRow } from '../../src/play';
import { PLAY_LABEL, limitWord, moveOf, rowMoved, shiftText, type ratingsWord } from './build-view';
import { el, icon } from './dom';

const ESTIMATE = 'Our estimate from the ratings and your settings. Not a measurement.';
const WAITING = 'Change the strings, tension or weight, and the ratings that move show here.';

/** `retry`: fetch the ratings again. */
export function doesSection(retry: () => void): { node: HTMLElement; sync(rows: PlayRow[], sentences: string[], word: ReturnType<typeof ratingsWord>, known: boolean): void } {
  const said = el('div', { class: 'verdict' });
  const notes = el('div', { class: 'does-notes' });
  const again = el('button', { class: 'button', type: 'button', hidden: true }, icon('retry'), 'Try again');
  again.addEventListener('click', retry);
  const head = el('h3', { class: 'ratings-head' });
  const views = new Map(PLAY_KEYS.map((key) => [key, playRow(PLAY_LABEL[key])] as const));
  const list = el('dl', { class: 'ratings estimate' }, ...[...views.values()].map((v) => v.node));
  const waiting = el('p', { class: 'bench-note' }, WAITING);
  const foot = el('p', { class: 'ratings-foot' }, ESTIMATE);

  let all = false;
  let why = false;
  let last: PlayRow[] = [];
  let word = '';
  const more = el('button', { class: 'text-button', type: 'button' });
  const reasons = el('button', { class: 'text-button', type: 'button' });
  more.addEventListener('click', () => {
    all = !all;
    draw();
  });
  reasons.addEventListener('click', () => {
    why = !why;
    draw();
  });

  /** Which rows stand, and what the two buttons offer. */
  function draw() {
    const moved = last.filter(rowMoved);
    const shown = all ? last : moved;
    for (const [key, v] of views) v.node.hidden = !shown.some((r) => r.key === key);
    list.classList.toggle('is-why', why);
    list.hidden = foot.hidden = shown.length === 0;
    head.textContent = word;
    head.hidden = !word || shown.length === 0;
    waiting.hidden = moved.length > 0;
    more.hidden = moved.length === last.length;
    more.textContent = all ? 'Show only what moved' : `Show all ${last.length} ratings`;
    more.setAttribute('aria-expanded', String(all));
    reasons.hidden = moved.length === 0;
    reasons.textContent = why ? 'Hide why' : 'Why?';
    reasons.setAttribute('aria-expanded', String(why));
  }

  return {
    node: el('section', { class: 'build-does', 'aria-labelledby': 'does-head' },
      el('h2', { class: 'bench-head', id: 'does-head' }, 'What it does'), said, notes, again, head, list, waiting,
      el('div', { class: 'does-more' }, more, reasons), foot),
    sync(rows, sentences, w, known) {
      said.replaceChildren(...sentences.map((s) => el('p', {}, s)));
      notes.replaceChildren(...w.notes.map((n) => el('p', { class: 'bench-note' }, n)));
      again.hidden = !w.retry;
      word = w.head;
      last = rows;
      for (const r of rows) views.get(r.key)!.set(r, known);
      draw();
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
  const limit = el('dd', { class: 'limit' });
  const why = el('dd', { class: 'reasons' });
  const node = el('div', { class: 'rating is-comparing' }, el('dt', {}, label), el('dd', {}, scale, arrow, value, delta, says), limit, why);
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
      delta.textContent = still ? '' : shiftText(shift);
      delta.dataset.dir = dir;
      const moves = still ? 'no change' : `${shift > 0 ? 'up' : 'down'} ${Math.abs(shift).toFixed(1)}`;
      says.textContent = known ? (v === null ? moves : `${v.toFixed(1)} out of 5, ${moves}`) : '';
      limit.textContent = limitWord(r);
      why.replaceChildren(...reasons.map((r) => el('span', { class: 'reason' }, `${shiftText(r.shift)} ${r.text}`)));
    },
  };
}
