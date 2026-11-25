// A ratings readout, 1 to 5: five pips a row, and rivals you can hold it up against. Shared by the
// racquet and string pages. Pure DOM; it knows nothing about what is being rated.
import { el } from './dom';

export interface RatedRival<K extends string> {
  name: string;
  href: string;
  ratings: Record<K, number>;
}

/** Every key at the highest mark, for the caption over the bars. */
export function topRatings<K extends string>(keys: readonly K[], ratings: Record<K, number>): K[] {
  const max = Math.max(...keys.map((k) => ratings[k]));
  return keys.filter((k) => ratings[k] === max);
}

/** How `other` differs, as keys: higher on power and spin, lower on control. */
export function differences<K extends string>(keys: readonly K[], ratings: Record<K, number>, other: Record<K, number>): { higher: K[]; lower: K[] } {
  return {
    higher: keys.filter((k) => other[k] > ratings[k]),
    lower: keys.filter((k) => other[k] < ratings[k]),
  };
}

/** "power, spin and control" */
export function inWords<K extends string>(ks: readonly K[], label: Record<K, string>): string {
  const words = ks.map((k) => label[k].toLowerCase());
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** `foot`: where the ratings come from, under the bars. */
export function ratingsView<K extends string>({ keys, label, ratings: own, rivals, foot }: {
  keys: readonly K[];
  label: Record<K, string>;
  ratings: Record<K, number>;
  rivals: ReadonlyArray<RatedRival<K>>;
  foot?: string;
}): HTMLElement {
  const tops = topRatings(keys, own);

  // Five pips a row, with a ring that shows where a chosen rival sits.
  const ghosts = new Map<K, { ring: HTMLElement; delta: HTMLElement }>();
  const ratings = el('dl', { class: 'ratings' },
    ...keys.map((k, row) => {
      const v = own[k];
      const ring = el('span', { class: 'ring', 'aria-hidden': 'true' });
      const delta = el('span', { class: 'delta', 'aria-hidden': 'true' });
      ghosts.set(k, { ring, delta });
      return el('div', { class: `rating${tops.includes(k) ? ' is-top' : ''}`, style: `--row: ${row}` },
        el('dt', {}, label[k]),
        el('dd', { 'aria-label': `${v} out of 5` },
          el('span', { class: 'pips', 'aria-hidden': 'true' },
            ...[1, 2, 3, 4, 5].map((n) => el('span', { class: `pip${n <= v ? ' on' : ''}`, style: `--n: ${n}` })),
            ring,
          ),
          el('span', { class: 'rating-n', 'aria-hidden': 'true' }, String(v)),
          delta,
        ),
      );
    }),
  );

  // Compare: one rival at a time; its ratings appear as rings on the same bars.
  const note = el('p', { class: 'compare-note', 'aria-live': 'polite' });
  const buttons: HTMLButtonElement[] = [];
  const show = (rival: RatedRival<K> | null) => {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(rival !== null && rivals[i] === rival)));
    ratings.classList.toggle('is-comparing', rival !== null);
    for (const k of keys) {
      const g = ghosts.get(k)!;
      if (!rival) {
        g.delta.textContent = '';
        continue;
      }
      const w = rival.ratings[k];
      const d = w - own[k];
      g.ring.style.setProperty('--at', String(w));
      g.ring.dataset.same = String(d === 0);
      g.delta.textContent = d === 0 ? '=' : d > 0 ? `+${d}` : `−${-d}`;
      g.delta.dataset.dir = d === 0 ? 'same' : d > 0 ? 'up' : 'down';
    }
    if (!rival) {
      note.replaceChildren();
      return;
    }
    const diff = differences(keys, own, rival.ratings);
    note.replaceChildren(
      `${rival.name} is `,
      diff.higher.length ? `stronger on ${inWords(diff.higher, label)}` : 'no stronger anywhere',
      diff.lower.length ? ` and weaker on ${inWords(diff.lower, label)}. ` : '. ',
      el('a', { href: rival.href }, `Open the ${rival.name}`),
    );
  };
  const compare = rivals.length
    ? el('div', { class: 'compare' },
        el('p', { class: 'compare-label', 'aria-hidden': 'true' }, 'Hold it up against'),
        el('div', { class: 'compare-buttons', role: 'group', 'aria-label': 'Hold it up against' },
          ...rivals.map((r) => {
            const b = el('button', { class: 'compare-btn', type: 'button', 'aria-pressed': 'false' }, r.name);
            b.addEventListener('click', () => show(b.getAttribute('aria-pressed') === 'true' ? null : r));
            buttons.push(b);
            return b;
          }),
        ),
        note,
      )
    : null;

  // The pips fill in as the ratings scroll into view, once.
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ratings.classList.add('is-waiting');
    const io = new IntersectionObserver((records) => {
      if (!records.some((r) => r.isIntersecting)) return;
      io.disconnect();
      ratings.classList.remove('is-waiting');
    }, { threshold: 0.4 });
    queueMicrotask(() => io.observe(ratings));
  }
  return el('div', {}, ratings, foot ? el('p', { class: 'ratings-foot' }, foot) : null, compare);
}
