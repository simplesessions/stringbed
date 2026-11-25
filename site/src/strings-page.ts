// The string rooms: one aisle per brand over a fan of spools, a brand's floor of them, and the page
// of one string. They are the racquets' rooms with other stock, so the aisle, the bay, the stage and
// the ratings are the racquets' own; main.ts lends what it owns (the stage, the header, transitions).
import { finder, foundHead, foundNone, type Finder } from './find-view';
import {
  GAUGE_CHOICES, NO_STRING_FIND, SHAPE_CHOICES, STRING_TRAITS, findStrings, formatStringFind, isEmptyFind, orderNote,
  parseStringFind, type StringFind,
} from './find';
import type { StringCatalog } from '../../src/catalog';
import type { StringMaterial, StringSpec } from '../../src/string-spec';
import { aisleView } from './aisle-view';
import { assetUrl } from './catalog-view';
import { crossSection } from './cross-section';
import { disc, el, faultPage, icon } from './dom';
import { sourcesLine } from './profile-view';
import { tagLabel } from './profiles';
import { inWords, ratingsView, topRatings } from './ratings-view';
import { brandSlug, isStringsRoute, parseHash, stringFindRoute, stringRoute, stringsRoute, type StringsRoute } from './routes';
import { loadStrings } from './strings-data';
import { MATERIALS, MATERIAL_LABEL, RATING_KEYS, RATING_LABEL, colourNote, firstGauge, resolveStrings, savedMaterial, sectionNote, shownStrings, stringAisles, stringFacts, stringNeighbours, stringStepName, gaugeName, gaugeNote, gaugeText } from './string-view';
import type { ThumbOptions } from './thumbnails';
import type { ShowOptions, Viewer } from './viewer';

/** What stands on the stage: a model file and how to draw it. */
export interface Exhibit {
  /** null: there is no file to show. */
  url: string | null;
  label: string;
  options?: ShowOptions;
  /** What the full screen says under it. */
  caption: { title: string; sub: string; facts: Array<[string, string]> };
}
export interface Stage {
  node: HTMLElement;
  /** null: nothing is drawn, only the flat stand-in. */
  viewer: Viewer | null;
  /** Put another exhibit on the stage, at the same angle and zoom. False when it cannot. */
  update(next: Exhibit): boolean;
}
export interface Sign {
  /** null: every brand. */
  brand: string | null;
  href: string;
  count: number;
}

/** What main.ts lends the string rooms. */
export interface Host {
  base: string;
  wall: HTMLElement;
  /** True once the 3D code has settled, one way or the other. */
  ready(): boolean;
  /** Make a change on screen: as a transition between places, or (`inPlace`) at once. */
  present(change: () => void, inPlace?: boolean): void;
  /** Point the header at the strings, with these brand signs. */
  enter(signs: Sign[], current: string | null): void;
  /** What to say about this address, if anything. */
  note(text: string): void;
  announce(text: string): void;
  /** The wall, or the detail view, takes the page. */
  showWall(title: string): void;
  showDetail(title: string, nodes: () => Node[]): void;
  preview(p: { url: string; name: string; item: HTMLElement; canvas: HTMLCanvasElement; hover: HTMLElement; options?: ThumbOptions }): void;
  /** Forget previews that have left the page. */
  prune(): void;
  stage(first: Exhibit, flat: SVGSVGElement): Stage;
  stepper(prev: { href: string; name: string }, next: { href: string; name: string }): HTMLElement;
  /** Ask which racquet to put a string on, and go there. */
  tryOn(s: StringSpec, colour: string): void;
}

export interface StringRooms {
  /** The material filter: the header shows it where the racquets have their sizes. */
  materials: HTMLElement;
  route(r: StringsRoute): void;
}

const MATERIAL_KEY = 'stringbed.material';
function storedMaterial(): StringMaterial | null {
  try {
    return savedMaterial(localStorage.getItem(MATERIAL_KEY));
  } catch {
    return null;
  }
}

/** Metres a bay frames: a reel is 0.07 m tall. */
const SPOOL_FRAME = 0.09;
/** The stage is lit for a racquet, so a reel stands on it this much larger. */
const SPOOL_SCALE = 6;

type Colour = StringSpec['colours'][number];
const tint = (hex: Colour['hex']) => ({ spool_string: hex });
const fullName = (s: StringSpec) => `${s.brand} ${s.name}`;
const some = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const stringsRouteFor = (brand: string | null) => stringsRoute(brand && brandSlug(brand));

export function stringRooms(host: Host): StringRooms {
  const { wall } = host;
  let data: StringCatalog | null = null;
  let loading = false;
  let material = storedMaterial();
  /** The brand whose floor is (or was last) on the wall; null: all of them. */
  let brand: string | null = null;
  /** What the home floor is filtered to, and the finder standing on it. */
  let find: StringFind = NO_STRING_FIND;
  let shelfFinder: Finder<StringFind> | null = null;
  /** The string last opened, to come back to on its floor. */
  let lastOpened: string | null = null;
  /** The string page on show: its colours change in place. */
  let page: { id: string; body: HTMLElement; show(colour: Colour): void } | null = null;
  /** The address the list failed at, while it says so on the wall. */
  let faultAt: string | null = null;

  const here = (): StringsRoute | null => {
    const r = parseHash(location.hash);
    return isStringsRoute(r) ? r : null;
  };

  // ---------- the list ----------

  function load() {
    if (loading) return;
    loading = true;
    faultAt = null;
    loadStrings().then(
      (d) => {
        loading = false;
        data = d;
        const r = here();
        if (r) route(r);
      },
      (err) => {
        loading = false;
        if (!here()) return;
        const fault = faultPage('The string list did not load.', err, () => {
          load();
          wait();
        });
        host.present(() => fill('strings-fault', 'Strings', [fault]), true);
        faultAt = location.hash;
        fault.querySelector('button')!.focus();
      },
    );
  }

  /** Put this on the wall. `data-floor` says which floor it is; main.ts and the sounds read it. */
  function fill(floor: string, title: string, nodes: Node[]) {
    host.showWall(title);
    wall.replaceChildren(...nodes);
    wall.dataset.floor = floor;
    host.prune();
    wall.setAttribute('aria-busy', String(floor === 'strings-wait'));
    enter();
  }

  /** Say that the list is on its way. Coming from another page, only if it is not here in a moment: then there is one move, not two. */
  function wait() {
    const say = () => {
      const late = loading || (data && !host.ready());
      if (!late || !here() || (wall.dataset.floor === 'strings-wait' && !wall.hidden)) return;
      host.present(() => fill('strings-wait', 'Strings', [el('p', { class: 'loading' }, 'Loading strings…')]));
    };
    if (host.ready()) setTimeout(say, 200);
    else say();
  }

  // ---------- header ----------

  const materials = el('div', { class: 'signs sizes materials', role: 'group', 'aria-label': 'String material', hidden: true },
    ...[null, ...MATERIALS].map((m) => {
      const b = el('button', { class: 'sign sign-size', type: 'button', 'data-material': m ?? '', 'aria-pressed': String(m === material) }, m ? MATERIAL_LABEL[m] : 'All');
      b.addEventListener('click', () => choose(m));
      return b;
    }));

  function choose(m: StringMaterial | null) {
    if (m === material || !data) return;
    material = m;
    try {
      if (m) localStorage.setItem(MATERIAL_KEY, m);
      else localStorage.removeItem(MATERIAL_KEY);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    for (const b of materials.querySelectorAll<HTMLElement>('[data-material]')) b.setAttribute('aria-pressed', String((b.dataset.material || null) === m));
    lastOpened = null;
    const finding = !brand && !isEmptyFind(find);
    if (!finding) host.announce(shownStrings(data.strings, m, brand));
    host.present(() => {
      floor(); // the filter stands only on a floor
      if (finding) announceFound();
    });
  }

  /** Brand signs for the current material; a brand with nothing in it has no sign. */
  function enter() {
    materials.hidden = !data;
    const aisles = data ? stringAisles(data.strings, material) : [];
    host.enter(data
      ? [
          { brand: null, href: stringsRoute(), count: aisles.reduce((n, x) => n + x.strings.length, 0) },
          ...aisles.map((x) => ({ brand: x.brand, href: stringsRouteFor(x.brand), count: x.strings.length })),
        ]
      : [], brand);
  }

  // ---------- floors ----------

  const spoolUrl = () => assetUrl(host.base, data!.spool.path);
  const spoolIn = (s: StringSpec): ThumbOptions => ({ colours: tint(s.colours[0].hex), fitHeight: SPOOL_FRAME });

  /** The floor the route names: a brand's, or every brand's aisle. */
  function floor() {
    if (brand) fill('string-brand', `${brand} strings`, brandFloor(brand));
    else fill('strings', 'Strings', homeFloor());
  }

  /** Nothing of this material here: say so, and offer the way out. */
  function empty(of: string): HTMLElement {
    const all = el('button', { class: 'button', type: 'button' }, 'Show all materials');
    all.addEventListener('click', () => {
      choose(null);
      materials.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    return el('div', { class: 'floor-empty' }, el('p', {}, `No ${material ? `${MATERIAL_LABEL[material].toLowerCase()} ` : ''}${of} here yet.`), material ? all : null);
  }

  function homeFloor(): Node[] {
    shelfFinder = finder<StringFind>({
      name: 'Find strings',
      traits: STRING_TRAITS,
      menus: [
        { key: 'gauge', label: 'Gauge', any: 'Any gauge', choices: GAUGE_CHOICES },
        { key: 'shape', label: 'Shape', any: 'Any shape', choices: SHAPE_CHOICES },
      ],
      toggles: [{ key: 'value', label: 'Good value' }],
      empty: NO_STRING_FIND,
      format: formatStringFind,
      change: refind,
      results: (f) => (isEmptyFind(f) ? aisleList() : stringResults(f)),
    }, find);
    return [el('h1', { class: 'sr-only' }, 'Strings'), ...shelfFinder.nodes];
  }

  /** The visitor changed the filter: the address follows, and the floor stays where it is. */
  function refind(f: StringFind) {
    const r = stringFindRoute(formatStringFind(f));
    history.replaceState(null, '', r);
    lastOpened = null;
    route(parseHash(r) as StringsRoute);
    if (isEmptyFind(f)) host.announce('Showing all brands.');
    else announceFound();
  }

  function announceFound() {
    const count = wall.querySelector('.found-count');
    if (count) host.announce(`${count.textContent}.`);
  }

  function stringResults(f: StringFind): Node[] {
    const { hits, noShape } = findStrings(data!.strings, f, material);
    const head = foundHead(
      hits.length ? `${some(hits.length, 'string')} ${hits.length === 1 ? 'matches' : 'match'}` : 'No strings match',
      hits.length ? orderNote(STRING_TRAITS, f.play, 'By brand.') : '',
      [noShape ? `${some(noShape, 'string')} with no stated shape ${noShape === 1 ? 'is' : 'are'} left out.` : null],
    );
    queueMicrotask(() => host.prune());
    if (!hits.length) {
      return [head, foundNone(`No ${material ? `${MATERIAL_LABEL[material].toLowerCase()} ` : ''}string has all of that.`, () => {
        refind(NO_STRING_FIND); // the material is the header's, and stays
        wall.querySelector<HTMLElement>('.find button')?.focus({ preventScroll: true });
      })];
    }
    return [head, el('ul', { class: 'bays spools found', role: 'list' }, ...hits.map((s) => bay(s, f)))];
  }

  function aisleList(): Node[] {
    const aisles = stringAisles(data!.strings, material);
    if (!aisles.length) return [empty('strings')];
    return [
      el('ul', { class: 'aisles', role: 'list' }, ...aisles.map((x) => aisleView({
        brand: x.brand,
        href: stringsRouteFor(x.brand),
        label: `${x.brand}: ${some(x.strings.length, 'string')} in ${some(x.colours, 'colour')}`,
        kind: 'spools',
        blades: x.fan.map((s) => ({
          swatch: s.colours[0].hex,
          flat: disc(),
          mount: (item, canvas, hover) => host.preview({ url: spoolUrl(), name: fullName(s), item, canvas, hover, options: spoolIn(s) }),
        })),
        tally: [el('span', {}, some(x.strings.length, 'string')), el('span', {}, some(x.colours, 'colour'))],
      }))),
    ];
  }

  function brandFloor(name: string): Node[] {
    const x = stringAisles(data!.strings, material).find((y) => y.brand === name);
    const head = el('header', { class: 'floor-head' },
      el('a', { class: 'back', href: stringsRoute() }, icon('back'), 'All brands'),
      el('h1', { class: 'floor-sign', style: `--letters: ${name.length}` }, el('span', { class: 'floor-name', style: `view-transition-name: brand-${brandSlug(name)}; view-transition-class: brand` }, name)),
      x ? el('p', { class: 'floor-tally' }, `${some(x.strings.length, 'string')} · ${some(x.colours, 'colour')}`) : null,
    );
    return [head, x ? el('ul', { class: 'bays spools', role: 'list' }, ...x.strings.map((s) => bay(s))) : empty(`${name} strings`)];
  }

  /** `found`: on the list of matches, where the brand and the ratings asked about join the tag. */
  function bay(s: StringSpec, found?: StringFind): HTMLElement {
    const canvas = el('canvas', { class: 'bay-canvas', 'aria-hidden': 'true' });
    const stage = el('span', { class: 'bay-stage' }, disc(), canvas);
    const link = el('a', { class: 'bay-link', href: stringRoute(s.id) },
      stage,
      el('span', { class: 'tag' },
        el('span', { class: 'tag-model' }, s.name),
        found ? el('span', { class: 'tag-meta' }, s.brand) : null,
        el('span', { class: 'tag-meta' }, [MATERIAL_LABEL[s.material], s.shape?.label].filter(Boolean).join(' · ')),
        found?.play.length ? el('span', { class: 'tag-ratings' }, ...found.play.map((k) => el('span', {}, `${RATING_LABEL[k]} `, el('b', {}, String(s.ratings[k]))))) : null,
        el('span', { class: 'tag-foot' },
          // On a match, what the ratings above already say is not said again.
          found?.play.some((k) => k === s.bestFor[0]) && !found.value ? null : el('span', { class: 'tag-best' }, found?.value ? 'Good value' : tagLabel(s.bestFor[0])),
          el('span', { class: 'version-dots' },
            ...s.colours.map((c) => el('span', { class: 'version-dot', style: `--chip: ${c.hex}`, 'aria-hidden': 'true' })),
            el('span', { class: 'sr-only' }, some(s.colours.length, 'colour'))),
        ),
      ),
    );
    link.addEventListener('click', () => {
      // Name only the spool on its way: it alone flies into the stage.
      for (const old of wall.querySelectorAll<HTMLElement>('.bay-stage[style*="view-transition-name"]')) old.style.viewTransitionName = '';
      stage.style.viewTransitionName = 'racquet';
    });
    const item = el('li', { class: 'bay', 'data-id': s.id, style: `--swatch: ${s.colours[0].hex}` }, link);
    host.preview({ url: spoolUrl(), name: fullName(s), item, canvas, hover: link, options: spoolIn(s) });
    return item;
  }

  // ---------- one string ----------

  function stringView(s: StringSpec, first: Colour): Node[] {
    const all = data!.strings;
    const { prev, next } = stringNeighbours(all, s);
    let shown = first;
    const tryOn = el('button', { class: 'dev-open', type: 'button', 'aria-haspopup': 'dialog' }, 'Put it on a racquet');
    tryOn.addEventListener('click', () => host.tryOn(s, shown.id));
    const nav = el('nav', { class: 'detail-nav', 'aria-label': 'String' },
      el('a', { class: 'back', href: stringsRouteFor(s.brand) }, icon('back'), `All ${s.brand}`),
      host.stepper({ href: stringRoute(prev.id), name: stringStepName(prev, s.brand) }, { href: stringRoute(next.id), name: stringStepName(next, s.brand) }),
      el('div', { class: 'detail-file' }, tryOn),
    );
    const exhibit = (colour: Colour): Exhibit => ({
      url: spoolUrl(),
      label: `3D view of a spool of ${fullName(s)}`,
      options: { colours: tint(colour.hex), scale: SPOOL_SCALE },
      caption: { title: s.name, sub: `${s.brand} · ${colour.name}`, facts: [['Material', MATERIAL_LABEL[s.material]], ['Shape', s.shape?.label ?? 'Not stated'], ['Gauge', gaugeText(s, firstGauge(s))], ['Best for', tagLabel(s.bestFor[0])]] },
    });
    const stage = host.stage(exhibit(first), disc());

    // The first colour is the string's own address, as a racquet's standard colourway is.
    const swatches = s.colours.length < 2 ? [] : s.colours.map((c, i) =>
      el('a', { class: 'colourway', href: stringRoute(s.id, i ? c.id : null), style: `--chip: ${c.hex}` },
        el('span', { class: 'colourway-chip', 'aria-hidden': 'true' }), c.name));
    const approximate = colourNote(s);
    const sheet = el('div', { class: 'sheet' },
      el('h1', { class: 'sheet-title', tabindex: '-1' }, s.name),
      el('div', { class: 'sheet-sub' }, el('span', {}, [s.brand, swatches.length ? null : s.colours[0].name].filter(Boolean).join(' · '))),
      swatches.length || approximate
        ? el('div', { class: 'pickers' },
            swatches.length ? el('div', { class: 'colourways', role: 'group', 'aria-label': 'Colour' }, ...swatches) : null,
            approximate ? el('p', { class: 'sheet-note' }, approximate) : null)
        : null,
      el('section', { class: 'profile', 'aria-labelledby': 'profile-head' },
        el('h2', { class: 'sheet-head', id: 'profile-head' }, 'How it plays'),
        el('p', { class: 'profile-summary' }, s.summary),
        el('ul', { class: 'profile-tags', role: 'list', 'aria-label': 'Best for' }, ...s.bestFor.map((t) => el('li', {}, tagLabel(t)))),
        el('h3', { class: 'ratings-head' }, 'Ratings', el('span', { class: 'ratings-note' }, `Highest: ${inWords(topRatings(RATING_KEYS, s.ratings), RATING_LABEL)}`)),
        ratingsView({
          keys: RATING_KEYS,
          label: RATING_LABEL,
          ratings: s.ratings,
          rivals: s.compared.flatMap((id) => all.filter((x) => x.id === id)).map((x) => ({ name: fullName(x), href: stringRoute(x.id), ratings: x.ratings })),
          foot: 'Our reading of review consensus, 1 to 5, against other strings in this set. Not lab data.',
        }),
      ),
      el('h2', { class: 'sheet-head' }, 'Facts'),
      el('dl', { class: 'rows' }, ...stringFacts(s).map((f) => el('div', { class: 'row' }, el('dt', {}, f.label), el('dd', {}, f.value)))),
      el('h2', { class: 'sheet-head' }, 'Cross-section'),
      section(s),
      sourcesLine(s),
    );
    const body = el('div', { class: 'detail-body' }, stage.node, sheet);
    const paint = (colour: Colour) => {
      shown = colour;
      body.style.setProperty('--swatch', colour.hex);
      s.colours.forEach((c, i) => swatches[i]?.setAttribute('aria-current', String(c === colour)));
    };
    paint(first);
    page = {
      id: s.id,
      body,
      show(colour) {
        paint(colour);
        stage.update(exhibit(colour)); // without WebGL the disc has already taken the colour
        host.announce(`Showing ${fullName(s)} in ${colour.name}.`);
      },
    };
    return [nav, body];
  }

  /** The string cut through, with a switch between the gauges it is sold in. */
  function section(s: StringSpec): HTMLElement {
    const cut = el('div', { class: 'section-cell' });
    const width = el('p', { class: 'section-gauge' });
    const tabs = s.gaugesMm.length > 1
      ? s.gaugesMm.map((g) => {
          const b = el('button', { class: 'gen-tab', type: 'button', 'data-gauge': String(g) }, gaugeText(s, g));
          b.addEventListener('click', () => draw(g));
          return b;
        })
      : [];
    const draw = (g: number) => {
      cut.replaceChildren(crossSection(s.shape, g));
      width.textContent = `${g.toFixed(2)} mm · ${gaugeName(s, g)} gauge`;
      for (const b of tabs) b.setAttribute('aria-pressed', String(b.dataset.gauge === String(g)));
    };
    draw(firstGauge(s));
    return el('div', { class: 'section' },
      cut,
      el('div', { class: 'section-facts' },
        width,
        el('p', { class: 'section-note' }, sectionNote(s.shape)),
        tabs.length ? el('div', { class: 'gen-tabs', role: 'group', 'aria-label': 'Gauge: millimetres and number' }, ...tabs) : null,
        gaugeNote(s) ? el('p', { class: 'sheet-note' }, gaugeNote(s)) : null,
        el('p', { class: 'sheet-note' }, 'Every string is drawn to this scale.'),
      ),
    );
  }

  // ---------- routing ----------

  function route(r: StringsRoute) {
    if (!data) {
      host.note('');
      // A fault stands until the visitor asks again or goes elsewhere; the 3D code settling is neither.
      if (faultAt === location.hash && wall.dataset.floor === 'strings-fault' && !wall.hidden) return;
      load();
      return wait();
    }
    const place = resolveStrings(r, data.strings);
    if (place.string && !host.ready()) return wait(); // or the page would say there is no WebGL when it is only late
    if (place.string && page?.id === place.string.id && page.body.isConnected) {
      page.show(place.colour);
      return;
    }
    host.note(place.notice);
    const to = place.string ? null : place.brand;
    // A string's own page leaves the filter alone; a floor's address says what it is.
    if (!place.string && !to) find = r.kind === 'string-find' ? parseStringFind(r.query) : NO_STRING_FIND;
    const built = wall.dataset.floor === (to ? 'string-brand' : 'strings') && brand === to;
    if (!place.string && built && !wall.hidden) {
      if (!to) {
        shelfFinder?.set(find);
        host.prune();
      }
      return;
    }
    host.present(() => {
      if (place.string) {
        const { string, colour } = place;
        lastOpened = string.id;
        host.showDetail(fullName(string), () => stringView(string, colour));
        enter();
        return;
      }
      page = null;
      brand = to;
      if (built) {
        if (!brand) shelfFinder?.set(find);
        host.showWall(brand ? `${brand} strings` : 'Strings');
        enter();
      } else floor();
      const back = lastOpened && wall.querySelector<HTMLElement>(`li[data-id="${lastOpened}"] .bay-link`);
      lastOpened = null;
      if (back) {
        back.focus({ preventScroll: true });
        back.scrollIntoView({ block: 'nearest' });
      } else if (!built) window.scrollTo(0, 0);
    });
  }

  return { materials, route };
}
