// The racquet page's profile: how the frame plays, what it is good for, and a ratings readout you
// can hold up against a close rival. Pure DOM; the data comes from profiles.ts.
import { el } from './dom';
import {
  LEVELS,
  RATING_KEYS,
  RATING_LABEL,
  differences,
  tagLabel,
  topRatings,
  type Profile,
  type RatingKey,
} from './profiles';

export interface Rival {
  id: string;
  name: string;
  href: string;
  profile: Profile;
}

const host = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const lower = (k: RatingKey) => RATING_LABEL[k].toLowerCase();
const list = (ks: RatingKey[]) => (ks.length < 2 ? ks.map(lower).join('') : `${ks.slice(0, -1).map(lower).join(', ')} and ${lower(ks[ks.length - 1])}`);

/** `family`: for a frame in several versions, its name and the version the ratings describe. */
export function profileView(p: Profile, rivals: Rival[], family: { name: string; rated: string } | null): HTMLElement {
  const tops = topRatings(p);
  const confidence = { high: 'well sourced', medium: 'reasonably sourced', low: 'thinly sourced' }[p.confidence];

  // Ratings: five pips a row, with a ring that shows where a chosen rival sits.
  const ghosts = new Map<RatingKey, { ring: HTMLElement; delta: HTMLElement }>();
  const ratings = el('dl', { class: 'ratings' },
    ...RATING_KEYS.map((k, row) => {
      const v = p.ratings[k];
      const ring = el('span', { class: 'ring', 'aria-hidden': 'true' });
      const delta = el('span', { class: 'delta', 'aria-hidden': 'true' });
      ghosts.set(k, { ring, delta });
      return el('div', { class: `rating${tops.includes(k) ? ' is-top' : ''}`, style: `--row: ${row}` },
        el('dt', {}, RATING_LABEL[k]),
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
  const show = (rival: Rival | null) => {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(rival !== null && rivals[i] === rival)));
    ratings.classList.toggle('is-comparing', rival !== null);
    for (const k of RATING_KEYS) {
      const g = ghosts.get(k)!;
      if (!rival) {
        g.delta.textContent = '';
        continue;
      }
      const w = rival.profile.ratings[k];
      const d = w - p.ratings[k];
      g.ring.style.setProperty('--at', String(w));
      g.ring.dataset.same = String(d === 0);
      g.delta.textContent = d === 0 ? '=' : d > 0 ? `+${d}` : `−${-d}`;
      g.delta.dataset.dir = d === 0 ? 'same' : d > 0 ? 'up' : 'down';
    }
    if (!rival) {
      note.replaceChildren();
      return;
    }
    const diff = differences(p, rival.profile);
    note.replaceChildren(
      `${rival.name} is `,
      diff.higher.length ? `stronger on ${list(diff.higher)}` : 'no stronger anywhere',
      diff.lower.length ? ` and weaker on ${list(diff.lower)}. ` : '. ',
      el('a', { href: rival.href }, `Open the ${rival.name}`),
    );
  };
  const compare = rivals.length
    ? el('div', { class: 'compare' },
        el('p', { class: 'compare-label', id: 'compare-label' }, 'Hold it up against'),
        el('div', { class: 'compare-buttons', role: 'group', 'aria-labelledby': 'compare-label' },
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

  const section = el('section', { class: 'profile', 'aria-labelledby': 'profile-head' },
    el('h2', { class: 'sheet-head', id: 'profile-head' }, family ? `How the ${family.name} plays` : 'How it plays'),
    el('p', { class: 'profile-style' }, p.playStyle),
    el('p', { class: 'profile-feel' }, `Feels ${p.feel}.`),
    el('ul', { class: 'profile-tags', role: 'list', 'aria-label': 'Best for' }, ...p.bestFor.map((t) => el('li', {}, tagLabel(t)))),
    el('p', { class: 'profile-summary' }, p.summary),
    el('div', { class: 'levels', role: 'group', 'aria-label': 'Suits players at' },
      ...LEVELS.map((l) => el('span', { class: `level${p.playerLevel.includes(l) ? ' on' : ''}`, 'aria-label': `${l}${p.playerLevel.includes(l) ? ', suited' : ', not the target'}` }, l.charAt(0).toUpperCase() + l.slice(1)))),
    el('h3', { class: 'ratings-head' }, family ? `Ratings for the ${family.rated}` : 'Ratings', el('span', { class: 'ratings-note' }, `Highest: ${list(tops)}`)),
    ratings,
    el('p', { class: 'ratings-foot' }, 'Our reading of review consensus, 1 to 5, against other adult frames in this set. Not lab data.'),
    compare,
    el('p', { class: 'profile-sources' },
      `${confidence[0].toUpperCase()}${confidence.slice(1)}; researched ${new Date(p.researchedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Read: `,
      ...p.sources.flatMap((u, i) => [i ? ', ' : '', el('a', { href: u, rel: 'noreferrer' }, host(u))]),
    ),
  );

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
  return section;
}
