// The racquet page's profile: how the frame plays, what it is good for, and its ratings. Pure DOM;
// the data comes from profiles.ts.
import { el } from './dom';
import { LEVELS, RATING_KEYS, RATING_LABEL, tagLabel, type Profile } from './profiles';
import { inWords, ratingsView, topRatings } from './ratings-view';

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

/** How well sourced a write-up is, when it was researched and what was read. */
export function sourcesLine({ confidence, researchedOn, sources }: Pick<Profile, 'confidence' | 'researchedOn' | 'sources'>): HTMLElement {
  const how = { high: 'Well sourced', medium: 'Reasonably sourced', low: 'Thinly sourced' }[confidence];
  return el('p', { class: 'profile-sources' },
    `${how}; researched ${new Date(researchedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}. Read: `,
    ...sources.flatMap((u, i) => [i ? ', ' : '', el('a', { href: u, rel: 'noreferrer' }, host(u))]),
  );
}

/** `family`: for a frame in several versions, its name and the version the ratings describe. */
export function profileView(p: Profile, rivals: Rival[], family: { name: string; rated: string } | null): HTMLElement {
  return el('section', { class: 'profile', 'aria-labelledby': 'profile-head' },
    el('h2', { class: 'sheet-head', id: 'profile-head' }, family ? `How the ${family.name} plays` : 'How it plays'),
    el('p', { class: 'profile-style' }, p.playStyle),
    el('p', { class: 'profile-feel' }, `Feels ${p.feel}.`),
    el('ul', { class: 'profile-tags', role: 'list', 'aria-label': 'Best for' }, ...p.bestFor.map((t) => el('li', {}, tagLabel(t)))),
    el('p', { class: 'profile-summary' }, p.summary),
    el('div', { class: 'levels', role: 'group', 'aria-label': 'Suits players at' },
      ...LEVELS.map((l) => el('span', { class: `level${p.playerLevel.includes(l) ? ' on' : ''}`, 'aria-label': `${l}${p.playerLevel.includes(l) ? ', suited' : ', not the target'}` }, l.charAt(0).toUpperCase() + l.slice(1)))),
    el('h3', { class: 'ratings-head' }, family ? `Ratings for the ${family.rated}` : 'Ratings', el('span', { class: 'ratings-note' }, `Highest: ${inWords(topRatings(RATING_KEYS, p.ratings), RATING_LABEL)}`)),
    ratingsView({
      keys: RATING_KEYS,
      label: RATING_LABEL,
      ratings: p.ratings,
      rivals: rivals.map((r) => ({ name: r.name, href: r.href, ratings: r.profile.ratings })),
      foot: 'Our reading of review consensus, 1 to 5, against other adult frames in this set. Not lab data.',
    }),
    sourcesLine(p),
  );
}
