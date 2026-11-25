// The find bar over a room's home floor, and what stands under it: every brand's aisle until something
// is picked, then the matches from all of them in one list. Pure DOM.
import { el } from './dom';
import { isEmptyFind, type RacquetFind, type StringFind } from './find';

type Find = RacquetFind | StringFind;
type Choice = { id: string; label: string };

export interface FindSpec<F extends Find> {
  /** What the bar is called to a screen reader: "Find racquets". */
  name: string;
  traits: ReadonlyArray<Choice>;
  /** One drop-down each; its first row, `any`, picks nothing. */
  menus: ReadonlyArray<{ key: keyof F & string; label: string; any: string; choices: ReadonlyArray<Choice> }>;
  toggles?: ReadonlyArray<{ key: keyof F & string; label: string }>;
  empty: F;
  format(f: F): string;
  /** The visitor changed the bar. */
  change(f: F): void;
  /** What stands under the bar for this filter. */
  results(f: F): Node[];
}

export interface Finder<F extends Find> {
  nodes: Node[];
  /** Show this filter; nothing moves when it is already on show. */
  set(f: F): void;
}

export function finder<F extends Find>(spec: FindSpec<F>, first: F): Finder<F> {
  let on = first;
  const pick = (patch: Partial<Record<keyof F, unknown>>) => spec.change({ ...on, ...patch } as F);

  const traits = spec.traits.map((t) => {
    const b = el('button', { class: 'sign sign-size', type: 'button', 'data-trait': t.id }, t.label);
    b.addEventListener('click', () => {
      const play = on.play as string[];
      pick({ play: play.includes(t.id) ? play.filter((x) => x !== t.id) : [...play, t.id] } as Partial<Record<keyof F, unknown>>);
    });
    return b;
  });
  const menus = spec.menus.map((m) => {
    const select = el('select', { class: 'find-menu', 'aria-label': m.label, 'data-key': m.key },
      el('option', { value: '' }, m.any),
      ...m.choices.map((c) => el('option', { value: c.id }, c.label)));
    select.addEventListener('change', () => pick({ [m.key]: select.value || null } as Partial<Record<keyof F, unknown>>));
    return select;
  });
  const toggles = (spec.toggles ?? []).map((t) => {
    const b = el('button', { class: 'find-toggle', type: 'button', 'data-key': t.key }, t.label);
    b.addEventListener('click', () => pick({ [t.key]: !on[t.key] } as Partial<Record<keyof F, unknown>>));
    return b;
  });
  const clear = el('button', { class: 'find-clear', type: 'button' }, 'Clear');
  clear.addEventListener('click', () => {
    spec.change(spec.empty);
    traits[0].focus({ preventScroll: true }); // the button is gone
  });

  const bar = el('div', { class: 'find', role: 'group', 'aria-label': spec.name },
    el('div', { class: 'find-traits', role: 'group', 'aria-label': 'Strong on' },
      el('span', { class: 'find-label', 'aria-hidden': 'true' }, 'Strong on'), ...traits),
    el('div', { class: 'find-menus' }, ...menus, ...toggles, clear),
  );
  const under = el('div', { class: 'find-under' });

  const draw = () => {
    for (const b of traits) b.setAttribute('aria-pressed', String((on.play as string[]).includes(b.dataset.trait!)));
    for (const s of menus) {
      const v = (on[s.dataset.key as keyof F] as string | null) ?? '';
      s.value = v;
      s.classList.toggle('is-set', v !== '');
    }
    for (const b of toggles) b.setAttribute('aria-pressed', String(Boolean(on[b.dataset.key as keyof F])));
    clear.hidden = isEmptyFind(on);
    under.replaceChildren(...spec.results(on));
  };
  draw();

  return {
    nodes: [bar, under],
    set(f) {
      if (spec.format(f) === spec.format(on)) return;
      on = f;
      draw();
    },
  };
}

/** The line over the matches: how many, and the order they stand in. */
export function foundHead(count: string, order: string, notes: Array<string | null>): HTMLElement {
  return el('header', { class: 'found-head' },
    el('h2', { class: 'found-count' }, count),
    el('p', { class: 'found-note' }, [order, ...notes].filter(Boolean).join(' ')));
}

/** Nothing matches: say so, and offer the way out. */
export function foundNone(what: string, clear: () => void): HTMLElement {
  const b = el('button', { class: 'button', type: 'button' }, 'Clear filters');
  b.addEventListener('click', clear);
  return el('div', { class: 'floor-empty' }, el('p', {}, what), b);
}
