// The racquet page's line-up: every version of the frame in one list, with the facts that tell
// them apart. Adults and juniors are separate lists; a colour belongs to the row it is a colour of.
// Choosing a version changes this in place. Rows never change height: what is said about the chosen
// version goes in a panel under the list, as tall as its longest text, so nothing below moves.
// Pure DOM; the grouping and ordering come from catalog-view.ts.
import type { Catalog } from '../../src/catalog';
import { lineupOf, routeFor, versionSpecs, wallName, type Racquet, type Version } from './catalog-view';
import { el } from './dom';

export interface LineupView {
  node: HTMLElement;
  /** Mark the version (and colour) on show. */
  select(current: Racquet, colourway: string | null): void;
  /** What reviewers say about each version, by version label. */
  setNotes(notes: Record<string, string>): void;
}

/** null when the frame comes in one version only. */
export function lineupView(c: Catalog, family: Racquet): LineupView | null {
  if (!family.variants?.length) return null;
  const { adult, junior } = lineupOf(c, family);
  const byId = new Map(c.racquets.map((r) => [r.id, r]));
  const idsOf = (v: Version) => [...new Set([v.racquet.id, ...v.colours.map((x) => x.racquetId)])];
  const label = (r: Racquet) => r.variantLabel ?? wallName(r);

  interface Entry {
    ids: string[];
    item: HTMLElement;
    link: HTMLElement;
    panel: HTMLElement;
    notes: Map<string, HTMLElement>;
    colours: HTMLElement[];
  }
  const entries: Entry[] = [];

  const list = (versions: Version[], base: Racquet | null, name: string) => {
    const facts = versions.map((v) => versionSpecs(v.racquet, base));
    const columns = (facts[0] ?? []).map((f) => f.key).filter((k) => facts.some((fs) => fs.find((f) => f.key === k)?.text));
    const made = versions.map((v, i): Entry => {
      const link = el('a', { class: 'version', href: routeFor(v.racquet.id), draggable: 'false' },
        el('span', { class: 'version-name' },
          label(v.racquet),
          v.colours.length
            ? el('span', { class: 'version-dots' },
                ...v.colours.map((x) => el('span', { class: 'version-dot', style: `--chip: ${x.swatch}`, 'aria-hidden': 'true' })),
                el('span', { class: 'sr-only' }, ` ${v.colours.length} colours`))
            : null,
        ),
        ...columns.map((k) => {
          const f = facts[i].find((x) => x.key === k)!;
          return el('span', { class: `version-fact${f.differs ? ' differs' : ''}` }, f.text ? ` ${f.text}` : null);
        }),
      );
      const colours = v.colours.map((x) =>
        el('a', { class: 'colourway', href: routeFor(x.racquetId, x.colourway), draggable: 'false', style: `--chip: ${x.swatch}` },
          el('span', { class: 'colourway-chip', 'aria-hidden': 'true' }), x.name));
      const ids = idsOf(v);
      const notes = new Map(ids.map((id) => [id, el('p', { class: 'version-note' })]));
      const panel = el('div', { class: 'version-panel' },
        el('div', { class: 'version-stack' }, ...notes.values()),
        colours.length ? el('div', { class: 'colourways', role: 'group', 'aria-label': `${label(v.racquet)} colours` }, ...colours) : null,
      );
      return { ids, item: el('li', { class: 'version-item' }, link), link, panel, notes, colours };
    });
    entries.push(...made);
    return el('div', { class: 'version-list' },
      el('ul', { class: 'versions', role: 'list', 'aria-label': name, style: `--cols: ${columns.length}` }, ...made.map((e) => e.item)),
      el('div', { class: 'version-stack version-panels' }, ...made.map((e) => e.panel)),
    );
  };

  const lists = [
    { name: 'Adult', versions: adult, node: list(adult, family, 'Adult versions') },
    { name: 'Junior', versions: junior, node: list(junior, null, 'Junior versions') },
  ].filter((l) => l.versions.length);
  const tabs = lists.map((l) => {
    const b = el('button', { class: 'gen-tab', type: 'button' }, l.name, el('span', { class: 'version-count' }, String(l.versions.length)));
    b.addEventListener('click', () => show(l));
    return b;
  });
  const show = (which: (typeof lists)[number]) =>
    lists.forEach((l, i) => {
      l.node.hidden = l !== which;
      tabs[i].setAttribute('aria-pressed', String(l === which));
    });

  return {
    node: el('div', { class: 'lineup-block' },
      lists.length > 1 ? el('div', { class: 'gen-tabs', role: 'group', 'aria-label': 'Adult or junior versions' }, ...tabs) : null,
      ...lists.map((l) => l.node),
    ),
    select(current, colourway) {
      const href = routeFor(current.id, colourway);
      for (const e of entries) {
        const on = e.ids.includes(current.id);
        e.item.classList.toggle('is-current', on);
        e.link.setAttribute('aria-current', String(on));
        e.panel.classList.toggle('is-shown', on);
        for (const [id, note] of e.notes) note.classList.toggle('is-shown', on && id === current.id);
        for (const a of e.colours) a.setAttribute('aria-current', String(a.getAttribute('href') === href));
      }
      show(lists.find((l) => l.versions.some((v) => idsOf(v).includes(current.id))) ?? lists[0]);
    },
    setNotes(notes) {
      for (const e of entries) {
        const row = label(byId.get(e.ids[0])!);
        for (const [id, p] of e.notes) {
          const own = label(byId.get(id)!);
          const [who, text] = notes[own] ? [own, notes[own]] : [row, notes[row]];
          p.replaceChildren(...(text ? [el('strong', {}, `${who}: `), text] : []));
        }
      }
    },
  };
}
