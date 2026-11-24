import './styles.css';
import fontLicence from './fonts/OFL.txt?url';
import type { Catalog } from '../../src/catalog';
import {
  assetFor,
  assetUrl,
  fileNameFromPath,
  formatBeam,
  formatBytes,
  formatCount,
  formatHeadSize,
  formatLength,
  formatPattern,
  generationLabel,
  wallGroups,
  aislesOf,
  shelvesOf,
  membersOf,
  brandRoute,
  brandSlug,
  parseBrandRoute,
  parseShelfRoute,
  type Aisle,
  type Shelf,
  isJunior,
  generationsOf,
  generationShort,
  lineageName,
  neighboursOf,
  stepName,
  groupPlaceholders,
  placeholderLabel,
  parseRoute,
  pickStyle,
  routeFor,
  inColourway,
  familyOf,
  wallName,
  searchRacquets,
  AGES,
  type Age,
  type BrandGroup,
  type Family,
  type Placeholder,
  type Racquet,
  type StockGroup,
  type Style,
} from './catalog-view';
import { el, icon, silhouette } from './dom';
import { fetchModelBytes } from './prefetch';
import { loadProfiles } from './profiles';
import { profileView, type Rival } from './profile-view';
import { lineupView } from './lineup-view';
import { play, setSound, soundOn, storedSound } from './sound';
import { LOOKS, LOOK_LABEL, storedLook, storeLook, type Look } from './look';
import type { Thumbnails, ThumbState, Viewer } from './gl';

const BASE = import.meta.env.BASE_URL;

type GL = typeof import('./gl');
let glModule: Promise<GL | null> | null = null;
/** Load the 3D code once; a failed load is forgotten so the next boot (Try again) retries it. */
const loadGL = (): Promise<GL | null> =>
  (glModule ??= import('./gl').catch(() => {
    glModule = null;
    return null;
  }));
// Start fetching the 3D code alongside the catalog; the page does not wait for it to list racquets.
void loadGL();
/** Bays waiting for the 3D code, so they can be wired up (or left flat) once it arrives. */
let pendingBays: Array<(thumbs: Thumbnails | null) => void> = [];
/** True once the 3D code has loaded or failed; bays built after that attach straight away. */
let glSettled = false;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wall = $<HTMLDivElement>('wall');
const detail = $<HTMLElement>('detail');
const signs = $<HTMLElement>('signs');
const notice = $<HTMLParagraphElement>('notice');
const announce = $<HTMLParagraphElement>('announce');
const baseTitle = document.title;
$<HTMLAnchorElement>('font-licence').href = fontLicence;

interface App {
  catalog: Catalog;
  style: Style;
  groups: BrandGroup[];
  order: Racquet[];
  /** Generation picked on each shelf (lineage → family id); newest when absent. */
  shelfGen: Map<string, string>;
  /** Variant standing on each shelf's stage (family id → racquet id). */
  shelfPick: Map<string, string>;
  stock: StockGroup[];
  stockOrder: Placeholder[];
  brand: string | null;
  age: Age;
  look: Look;
  gl: GL | null;
  thumbs: Thumbnails | null;
  viewer: Viewer | null | undefined; // undefined: not tried yet
  lastOpened: string | null;
}
let app: App | null = null;
/** False until the 3D code has settled; routing waits so a detail view never misreports WebGL. */
let ready = false;
/** The standing notice (no WebGL, no 3D code); route-specific notes are added in front of it. */
let baseNotice = '';

// ---------- catalog ----------

async function boot() {
  wall.setAttribute('aria-busy', 'true');
  wall.replaceChildren(el('p', { class: 'loading' }, 'Loading racquets…'));
  let catalog: Catalog;
  try {
    const res = await fetch(assetUrl(BASE, 'catalog.json'));
    if (!res.ok) throw new Error(`The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`);
    catalog = (await res.json().catch(() => {
      throw new Error('The catalog file is not valid JSON.');
    })) as Catalog;
    if (!Array.isArray(catalog?.racquets) || !Array.isArray(catalog?.styles)) throw new Error('The catalog file is not in the expected format.');
  } catch (err) {
    return catalogFailed(err);
  }
  const style = pickStyle(catalog, new URLSearchParams(location.search).get('style'));
  if (!style) return catalogFailed(new Error('The catalog lists no styles.'));
  const age = storedAge();
  const groups = wallGroups(catalog, age, false);
  const stock = groupPlaceholders(catalog);
  app = {
    catalog,
    style,
    groups,
    order: groups.flatMap((g) => g.racquets),
    stock,
    stockOrder: stock.flatMap((g) => g.families.flatMap((f) => f.variants.map((v) => v.item))),
    shelfGen: new Map(),
    shelfPick: new Map(),
    brand: null,
    age,
    look: storedLook(),
    gl: null,
    thumbs: null,
    viewer: undefined,
    lastOpened: null,
  };
  const a = app;
  a.brand = parseBrandRoute(location.hash, brandsOf(a));
  buildHeader(a);
  renderFloor(a);
  a.gl = await loadGL();
  a.thumbs = a.gl?.Thumbnails.create() ?? null;
  a.thumbs?.setLook(a.look);
  for (const attach of pendingBays) attach(a.thumbs);
  pendingBays = [];
  glSettled = true;
  ready = true;
  baseNotice = !a.gl
    ? 'The 3D viewer did not load, so racquets show as colour silhouettes. Specs and downloads still work.'
    : !a.thumbs
      ? 'This browser is not giving the page WebGL, so racquets show as colour silhouettes. Specs and downloads still work.'
      : '';
  notice.textContent = baseNotice;
  route();
}

function catalogFailed(err: unknown) {
  // A thrown TypeError is fetch's network failure; anything else is a message we wrote.
  const offline = !(err instanceof Error) || err instanceof TypeError;
  const reason = offline ? 'The request did not reach the server. Check your connection, then try again.' : `${(err as Error).message} Try again in a moment.`;
  const retry = el('button', { class: 'button', type: 'button' }, icon('retry'), 'Try again');
  retry.addEventListener('click', () => void boot());
  wall.setAttribute('aria-busy', 'false');
  wall.replaceChildren(
    el('div', { class: 'fault-page', role: 'alert' },
      el('h1', { class: 'fault-title' }, 'The racquet list did not load.'),
      el('p', {}, reason),
      retry,
    ),
  );
  retry.focus();
}

// ---------- header ----------

const AGE_KEY = 'stringbed.age';
const AGE_LABEL: Record<Age, string> = { adult: 'Adult', junior: 'Junior', all: 'All sizes' };
function storedAge(): Age {
  try {
    const v = localStorage.getItem(AGE_KEY) as Age | null;
    return v && AGES.includes(v) ? v : 'adult';
  } catch {
    return 'adult';
  }
}

/** Racquets per brand for the current size filter: modelled ones (all adult) plus placeholders. */
function brandCounts(a: App): Map<string, number> {
  const counts = new Map<string, number>();
  for (const x of aislesOf(a.catalog, a.age)) counts.set(x.brand, x.racquets);
  for (const g of groupPlaceholders(a.catalog, a.age)) counts.set(g.brand, (counts.get(g.brand) ?? 0) + g.count);
  return counts;
}

function brandsOf(a: Pick<App, 'catalog'>): string[] {
  return [...new Set([...a.catalog.racquets.map((r) => r.brand), ...(a.catalog.placeholders ?? []).map((p) => p.brand)])];
}

const sizes = el('div', { class: 'signs sizes', role: 'group', 'aria-label': 'Racquet size' });

function buildHeader(a: App) {
  renderSigns(a);
  // Size is a second, smaller axis: three choices, adult by default and remembered.
  sizes.replaceChildren(...AGES.map((age) => {
    const b = el('button', { class: 'sign sign-size', type: 'button', 'aria-pressed': String(age === a.age) }, AGE_LABEL[age]);
    b.addEventListener('click', () => {
      if (a.age === age) return;
      a.age = age;
      try {
        localStorage.setItem(AGE_KEY, age);
      } catch {
        /* private mode: the choice lasts for this visit */
      }
      for (const x of sizes.children) x.setAttribute('aria-pressed', String(x === b));
      a.lastOpened = null;
      regroup(a);
      renderSigns(a);
      transition(() => renderFloor(a));
      announceShown(a);
      if (wall.hidden) location.hash = a.brand ? brandRoute(a.brand) : routeFor(null);
    });
    return b;
  }));
  if (!sizes.isConnected) signs.after(sizes);
  if (!headerLook) {
    headerLook = lookControl(a);
    searchOpen.before(headerLook);
  }
  signs.hidden = false;
  searchOpen.hidden = false;
}

// Look: how the 3D previews are drawn. Viewer-only, unrelated to the catalog's asset styles.
// The header carries it on wider screens; on phones it sits in the detail stage's controls.
let headerLook: HTMLElement | null = null;
const lookControls = new Set<HTMLElement>();

function lookControl(a: App): HTMLElement {
  const group = el('div', { class: 'looks', role: 'group', 'aria-label': 'Look of the 3D previews' },
    el('span', { class: 'looks-label', 'aria-hidden': 'true' }, 'Look'));
  for (const look of LOOKS) {
    const b = el('button', { class: 'sign sign-size', type: 'button', 'data-look': look, 'aria-pressed': String(look === a.look) }, LOOK_LABEL[look]);
    b.addEventListener('click', () => setLook(a, look));
    group.append(b);
  }
  lookControls.add(group);
  return group;
}

function setLook(a: App, look: Look) {
  if (a.look === look) return;
  a.look = look;
  storeLook(look);
  for (const group of lookControls) {
    if (!group.isConnected && group !== headerLook) {
      lookControls.delete(group);
      continue;
    }
    for (const b of group.querySelectorAll<HTMLElement>('[data-look]')) b.setAttribute('aria-pressed', String(b.dataset.look === look));
  }
  a.thumbs?.setLook(look);
  if (a.viewer) a.viewer.setLook(look);
  announce.textContent = `${LOOK_LABEL[look]} look.`;
}

function announceShown(a: App) {
  const counts = brandCounts(a);
  const shown = a.brand ? (counts.get(a.brand) ?? 0) : [...counts.values()].reduce((x, y) => x + y, 0);
  const size = a.age === 'all' ? '' : ` ${a.age}`;
  announce.textContent = a.brand ? `Showing ${shown}${size} ${a.brand} racquets.` : `Showing all ${shown}${size} racquets.`;
}

/** Brand signs for the current size; a brand with nothing in that size has no sign. */
function renderSigns(a: App) {
  const counts = brandCounts(a);
  const brands = [...counts.keys()].sort((x, y) => x.localeCompare(y, 'en'));
  const n = [...counts.values()].reduce((x, y) => x + y, 0);
  // Brand signs are the floor's directory: each opens that brand's aisle.
  const links: HTMLAnchorElement[] = [];
  const add = (brand: string | null, label: string, count: number) =>
    links.push(el('a', { class: 'sign', href: brand ? brandRoute(brand) : routeFor(null), 'data-brand': brand ?? '' },
      el('span', {}, label), el('span', { class: 'sign-count' }, String(count))));
  add(null, 'All brands', n);
  for (const b of brands) add(b, b, counts.get(b)!);
  signs.replaceChildren(...links);
  markSigns(a);

  // Styles come from the catalog. With a single style there is nothing to switch.
  if (a.catalog.styles.length > 1) {
    const links = a.catalog.styles.map((s) =>
      el('a', { class: 'sign', href: `?style=${encodeURIComponent(s.id)}${location.hash}`, 'aria-current': s.id === a.style.id ? 'true' : null }, s.label),
    );
    signs.append(el('span', { class: 'signs-break', 'aria-hidden': 'true' }), ...links);
  }
}

/** Recompute what the wall shows after the size or the older-generations choice changed. */
function regroup(a: App) {
  a.groups = wallGroups(a.catalog, a.age, false);
  a.order = a.groups.flatMap((g) => g.racquets);
}

/** Show which floor the visitor is on: a brand, or all brands on the home floor. */
function markSigns(a: App) {
  for (const l of signs.querySelectorAll<HTMLElement>('a.sign[data-brand]')) {
    const on = !wall.hidden && (l.dataset.brand || null) === a.brand;
    if (on) l.setAttribute('aria-current', 'page');
    else l.removeAttribute('aria-current');
  }
}

// ---------- wall ----------

/** Researched racquets with no model yet: a plain list under the wall, one column per brand. */
function stockList(a: App): HTMLElement[] {
  const stock = groupPlaceholders(a.catalog, a.age).filter((g) => g.brand === a.brand);
  if (stock.length === 0) return [el('section', { class: 'stock', hidden: true })];
  const total = stock.reduce((n, g) => n + g.count, 0);
  const family = (f: Family, showSize: boolean) =>
    el('li', { class: 'family' },
      el('h3', { class: 'family-name' }, f.line, el('span', { class: 'sign-count' }, String(f.variants.length))),
      el('ul', { class: 'stock-tags', role: 'list' }, ...f.variants.map((v) => variantChip(v.item, v.label, showSize))),
    );
  const brand = (g: StockGroup) =>
    el('section', { class: 'stock-brand', 'data-brand': g.brand, 'aria-label': `${g.brand}, no model yet` },
      el('ul', { class: 'families', role: 'list' }, ...g.families.map((f) => family(f, a.age === 'all'))),
    );
  return [
    el('section', { class: 'stock', 'aria-labelledby': 'stock-title' },
      el('h2', { class: 'shelf-name', id: 'stock-title' }, 'No model yet', el('span', { class: 'sign-count' }, String(total))),
      el('p', { class: 'stock-lede' }, 'Researched from retailer listings and not yet modelled. Specs are unverified and often incomplete.'),
      el('div', { class: 'stock-brands' }, ...stock.map(brand)),
    ),
  ];
}

/** One variant of a product line: a small tag, so a line of twelve takes two rows, not twelve. */
function variantChip(p: Placeholder, label: string, showSize: boolean): HTMLLIElement {
  const s = p.specs;
  const facts = [placeholderLabel(p), s.headSizeSqIn ? `${s.headSizeSqIn} in²` : null, s.stringPattern ? formatPattern(s.stringPattern) : null].filter(Boolean).join(' · ');
  const junior = p.category === 'junior' && showSize;
  return el('li', { 'data-id': p.id },
    el('a', { class: 'stock-tag', href: routeFor(p.id), title: facts ? `${p.model}: ${facts}` : p.model, 'aria-label': `${p.model}${junior ? ', junior' : ''}` },
      label, junior ? el('span', { class: 'stock-flag' }, 'Jr') : null),
  );
}

// ---------- the shop floor ----------
//
// Home is one aisle per brand: the brand's sign over a fan of its current flagships, held at
// the butt caps like a hand of cards. An aisle opens that brand's floor (#/b/<brand>): one shelf
// per line, each standing the line's sizes side by side at one true scale, with generation tabs
// that swap what stands on the shelf.

const FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-9, 9],
  3: [-16, 0, 16],
  4: [-18, -6, 6, 18],
  5: [-21, -10.5, 0, 10.5, 21],
};

/** Render whichever floor the route names: a brand's, or the home aisles. */
function renderFloor(a: App) {
  const views = a.brand ? brandFloor(a, a.brand) : homeFloor(a);
  wall.replaceChildren(...views);
  wall.dataset.floor = a.brand ? 'brand' : 'home';
  a.thumbs?.prune();
  wall.setAttribute('aria-busy', 'false');
  markSigns(a);
}

function homeFloor(a: App): HTMLElement[] {
  const aisles = aislesOf(a.catalog, a.age);
  return [
    el('h1', { class: 'sr-only' }, 'Brands'),
    el('ul', { class: 'aisles', role: 'list' }, ...aisles.map((x, k) => aisle(a, x, k))),
  ];
}

function aisle(a: App, x: Aisle, k: number): HTMLLIElement {
  const slug = brandSlug(x.brand);
  const angles = FAN_ANGLES[x.fan.length] ?? FAN_ANGLES[5];
  const link = el('a', { class: 'aisle-link', href: brandRoute(x.brand), 'aria-label': `${x.brand}: ${x.racquets} racquets in ${x.lines} lines` });
  const fan = el('span', { class: 'fan', 'aria-hidden': 'true' });
  x.fan.forEach((r, i) => {
    const canvas = el('canvas', { class: 'bay-canvas' });
    const off = i - (x.fan.length - 1) / 2;
    // Centre blade on top; the fans open aisle by aisle, centre out.
    const r1 = (n: number) => (Math.random() - 0.5) * 2 * n;
    // A degree or two of play, and its own beat, travel and sway: the hand never reads as copies.
    const blade = el('span', { class: 'blade', style: `--a: ${(angles[i] + r1(1.6)).toFixed(2)}deg; --i: ${off}; --k: ${Math.round(Math.abs(off) * 2)}; z-index: ${10 - Math.round(Math.abs(off) * 2)}; --swatch: ${r.swatch}; --delay: ${Math.round(Math.abs(off) * 90 + Math.random() * 140)}ms; --dur: ${Math.round(820 + Math.random() * 420)}ms; --sway: ${(6 + Math.random() * 4).toFixed(1)}s; --sway-delay: ${(-Math.random() * 6).toFixed(1)}s` },
      el('span', { class: 'bay-stage' }, silhouette(r.specs.headSizeSqIn), canvas));
    fan.append(blade);
    thumbnail(a, r, blade, canvas, link);
  });
  const centre = x.fan[Math.floor(x.fan.length / 2)];
  link.append(
    // The morph is named on the word itself, not the full-width sign: the boxes on both ends
    // must hug the lettering, or the snapshot scales by box width and overshoots the title.
    el('span', { class: 'aisle-sign' }, el('span', { class: 'aisle-name', style: `view-transition-name: brand-${slug}; view-transition-class: brand` }, x.brand)),
    fan,
    el('span', { class: 'aisle-rail', style: `--swatch: ${centre?.swatch ?? 'var(--rail)'}` }),
    el('span', { class: 'aisle-tag' },
      el('span', {}, `${x.lines} ${x.lines === 1 ? 'line' : 'lines'}`),
      el('span', {}, `${x.racquets} ${x.racquets === 1 ? 'racquet' : 'racquets'}`),
      x.colourways ? el('span', {}, `${x.colourways} ${x.colourways === 1 ? 'colourway' : 'colourways'}`) : null,
      x.noModel ? el('span', { class: 'aisle-soft' }, `+${x.noModel} no model yet`) : null,
    ),
  );
  const item = el('li', { class: 'aisle', 'data-brand': x.brand }, link);
  openWhenSeen(item);
  return item;
}

/** Open an aisle's fan when it scrolls into view and its racquets have arrived (or a moment has passed). */
function openWhenSeen(item: HTMLElement) {
  const open = () => {
    item.dataset.open = '';
    play('swish');
    setTimeout(() => (item.dataset.settled = ''), 1500);
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    item.dataset.open = '';
    item.dataset.settled = '';
    return;
  }
  const io = new IntersectionObserver((records) => {
    if (!records.some((r) => r.isIntersecting)) return;
    io.disconnect();
    const started = performance.now();
    const check = () => {
      const blades = [...item.querySelectorAll<HTMLElement>('.blade')];
      const loaded = blades.every((b) => b.dataset.state === 'ready' || b.dataset.state === 'flat' || b.dataset.state === 'failed');
      if (loaded || performance.now() - started > 1400) open();
      else setTimeout(check, 80);
    };
    check();
  }, { threshold: 0.25 });
  io.observe(item);
}

function brandFloor(a: App, brand: string): HTMLElement[] {
  const shelves = shelvesOf(a.catalog, brand, a.age);
  const x = aislesOf(a.catalog, a.age).find((y) => y.brand === brand);
  const head = el('header', { class: 'floor-head' },
    el('a', { class: 'back', href: routeFor(null) }, icon('back'), 'All brands'),
    el('h1', { class: 'floor-sign' }, el('span', { class: 'floor-name', style: `view-transition-name: brand-${brandSlug(brand)}; view-transition-class: brand` }, brand)),
    x
      ? el('p', { class: 'floor-tally' }, `${x.lines} ${x.lines === 1 ? 'line' : 'lines'} · ${x.racquets} racquets${x.colourways ? ` · ${x.colourways} colourways` : ''}`)
      : null,
  );
  // Outside the header, so it can stay pinned for the whole floor, not just the header's height.
  const index = shelves.length > 1
    ? el('nav', { class: 'floor-index', 'aria-label': `${brand} lines` },
        ...shelves.map((sh) => el('a', { href: brandRoute(brand, sh.lineage), 'data-shelf': sh.lineage }, sh.name)))
    : null;
  const empty = shelves.length
    ? null
    : el('p', { class: 'floor-empty' }, `No ${a.age === 'all' ? '' : `${a.age} `}${brand} racquets have a 3D model yet.`);
  return [head, ...(index ? [index] : []), ...(empty ? [empty] : []), ...shelves.map((sh) => shelf(a, sh)), ...stockList(a)];
}

/**
 * A line's shelf: one pinned racquet and a line-up of its variants. The variants of a line
 * (100, 98, Team, Lite) are near-identical frames, so they are not stood in a row of look-alikes:
 * the stage holds one racquet, the line-up lists every variant at one size. Pointing at a row (or
 * tabbing to it) stands that racquet in the stage; clicking the row opens it.
 */
function shelf(a: App, sh: Shelf): HTMLElement {
  const picked = a.shelfGen.get(sh.lineage);
  const family = sh.generations.find((g) => g.id === picked) ?? sh.generations[0];
  const members = membersOf(a.catalog, family, a.age);
  const id = `shelf-${sh.lineage}`;
  const tabs = sh.generations.length > 1
    ? el('div', { class: 'gen-tabs', role: 'group', 'aria-label': `${sh.name} generation` },
        ...sh.generations.map((g) => {
          const b = el('button', { class: 'gen-tab', type: 'button', 'aria-pressed': String(g === family) }, generationShort(g));
          b.addEventListener('click', () => {
            if (g === family) return;
            a.shelfGen.set(sh.lineage, g.id);
            play('pick');
            const section = document.getElementById(id);
            transition(() => {
              section?.replaceWith(shelf(a, sh));
              a.thumbs?.prune();
            });
            requestAnimationFrame(() => document.getElementById(id)?.querySelector<HTMLElement>('.gen-tab[aria-pressed="true"]')?.focus({ preventScroll: true }));
            announce.textContent = `${sh.name} ${generationShort(g)}: ${membersOf(a.catalog, g, a.age).length} racquets.`;
          });
          return b;
        }))
    : el('span', { class: 'gen-only' }, generationShort(family));

  const initial = members.find((r) => r.id === a.shelfPick.get(family.id)) ?? members[0];
  const stageLink = el('a', { class: 'shelf-stage', href: routeFor(initial.id), 'data-family': family.id });
  const slotHost = el('span', { class: 'shelf-slots' });
  const title = el('span', { class: 'shelf-title' });
  const readout = el('dl', { class: 'readout' });
  const open = el('a', { class: 'button lineup-open' });
  stageLink.append(slotHost, el('span', { class: 'shelf-rail' }), title);
  const opening = () => {
    // Name only the clicked racquet (not its tinted panel), so the racquet alone flies into the
    // detail stage while the panel's background fades away with the rest of the page.
    for (const old of wall.querySelectorAll<HTMLElement>('.shelf-slots[style*="view-transition-name"]')) old.style.viewTransitionName = '';
    slotHost.style.viewTransitionName = 'racquet';
    a.lastOpened = family.id;
  };
  stageLink.addEventListener('click', opening);

  let current: Racquet | null = null;
  const rows: HTMLAnchorElement[] = [];
  const select = (r: Racquet, how: 'first' | 'swap') => {
    if (current === r) return;
    const dir = current ? Math.sign(members.indexOf(r) - members.indexOf(current)) || 1 : 0;
    current = r;
    a.shelfPick.set(family.id, r.id);
    rows.forEach((row, i) => row.classList.toggle('is-on', members[i] === r));
    // The next racquet arrives on a spring from the side it sits on in the list; the old one leaves.
    const canvas = el('canvas', { class: 'bay-canvas', 'aria-hidden': 'true' });
    const slot = el('span', { class: 'slot', style: `--swatch: ${r.swatch}; --dir: ${dir}`, 'data-id': r.id }, silhouette(r.specs.headSizeSqIn), canvas);
    for (const old of slotHost.querySelectorAll<HTMLElement>('.slot:not(.is-out)')) {
      old.classList.add('is-out');
      setTimeout(() => {
        old.remove();
        a.thumbs?.prune();
      }, 520);
    }
    slotHost.append(slot);
    slot.classList.toggle('is-first', how === 'first');
    thumbnail(a, r, slot, canvas, stageLink);
    stageLink.href = routeFor(r.id);
    stageLink.style.setProperty('--swatch', r.swatch);
    stageLink.setAttribute('aria-label', `${wallName(r)}, open the 3D view`);
    title.replaceChildren(el('span', { class: 'shelf-title-name' }, wallName(r)), el('span', { class: 'shelf-title-meta' }, generationLabel(r)));
    const s = r.specs;
    readout.replaceChildren(
      ...([
        ['Head size', formatHeadSize(s.headSizeSqIn).primary],
        ['Length', formatLength(s.lengthIn).primary],
        ['Pattern', formatPattern(s.stringPattern)],
        s.unstrungWeightG ? ['Weight', `${formatCount(s.unstrungWeightG)} g`] : null,
      ].filter(Boolean) as string[][]).map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))),
    );
    open.href = routeFor(r.id);
    open.replaceChildren(`Open the ${r.variantLabel ?? wallName(r)}`, icon('next'));
    if (how === 'swap') play('hover', members.indexOf(r));
  };

  const lineup = el('ul', { class: 'lineup', role: 'list', 'aria-label': `${sh.name} variants` },
    ...members.map((r) => {
      const s = r.specs;
      const row = el('a', { class: 'lineup-row', href: routeFor(r.id), draggable: 'false' },
        el('span', { class: 'lineup-name' }, r.variantLabel ?? wallName(r)),
        el('span', { class: 'lineup-spec' }, [formatHeadSize(s.headSizeSqIn).primary, formatPattern(s.stringPattern), isJunior(r) ? `${s.lengthIn} in` : null].filter(Boolean).join(' · ')),
        r.colourways?.length ? el('span', { class: 'lineup-more' }, `${r.colourways.length + 1} colourways`) : null,
        icon('next'),
      );
      rows.push(row);
      row.addEventListener('focus', () => select(r, 'swap'));
      row.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') select(r, 'swap');
      });
      row.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab or window: this page stays
        select(r, 'swap'); // a tap gives no hover, so make sure this racquet is the one that flies
        opening();
      });
      return el('li', {}, row);
    }),
  );
  select(initial, 'first');

  const section = el('section', { class: 'shelf', id, 'aria-labelledby': `${id}-name`, style: `view-transition-name: ${id}` },
    el('div', { class: 'shelf-head' },
      el('h2', { class: 'shelf-name', id: `${id}-name` }, sh.name, el('span', { class: 'sign-count' }, String(members.length))),
      tabs,
    ),
    el('div', { class: 'shelf-body' }, stageLink, el('div', { class: 'shelf-side' }, lineup, readout, open)),
  );
  // Quietly bring every other variant's file in, so choosing a row never waits on the network.
  const warm = () => members.forEach((r) => {
    const asset = assetFor(r, a.style.id);
    if (asset) void fetchModelBytes(assetUrl(BASE, asset.path), 'low').catch(() => {});
  });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 800);
  return section;
}

/** Hook a canvas up to the shared thumbnail renderer once the 3D code has settled. */
function thumbnail(a: App, r: Racquet, item: HTMLElement, canvas: HTMLCanvasElement, hover: HTMLElement) {
  const asset = assetFor(r, a.style.id);
  if (!asset) {
    item.dataset.state = 'flat';
    return;
  }
  void fetchModelBytes(assetUrl(BASE, asset.path)).catch(() => {}); // download now; parse when the renderer is up
  const attach = (thumbs: Thumbnails | null) => {
    if (thumbs) watch(thumbs, item, hover, canvas, r, asset.path);
    else item.dataset.state = 'flat';
  };
  if (glSettled) attach(a.thumbs);
  else pendingBays.push(attach);
}

let activeTransition: { skipTransition(): void } | null = null;

/** Finish any running transition at once; the page underneath is already in its end state. */
function settle(): void {
  activeTransition?.skipTransition();
  activeTransition = null;
}

/**
 * Run a DOM change as a view transition where the browser has them and motion is welcome.
 */
function transition(change: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void>; skipTransition(): void } };
  settle(); // the newest click wins
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change();
    return;
  }
  // Rendering is paused during the update, so it must not wait for frames: fresh thumbnails
  // arrive as silhouettes in the snapshot and fade to 3D a moment later.
  const t = doc.startViewTransition(change);
  activeTransition = t;
  t.finished.finally(() => {
    if (activeTransition === t) activeTransition = null;
  });
}

function watch(thumbs: Thumbnails, item: HTMLElement, link: HTMLElement, canvas: HTMLCanvasElement, r: Racquet, path: string) {
  const retry = el('button', { class: 'bay-retry', type: 'button' }, icon('retry'), 'Retry');
  retry.setAttribute('aria-label', `Retry loading the ${r.model} preview`);
  const fault = el('span', { class: 'bay-fault', hidden: true }, el('span', {}, 'Preview failed'), retry);
  item.append(fault);
  retry.addEventListener('click', () => {
    link.focus(); // the button hides as loading starts; keep focus on the entry
    thumbs.retry(canvas);
  });
  thumbs.add(canvas, assetUrl(BASE, path), link, (state: ThumbState) => {
    item.dataset.state = state;
    fault.hidden = state !== 'failed';
  });
}

// ---------- routing ----------

let routed = false;

/** Bring a line's shelf into view (under the sticky line index) and focus its heading. */
function scrollToShelf(lineage: string | null, smooth: boolean) {
  const shelfEl = lineage ? document.getElementById(`shelf-${lineage}`) : null;
  if (!shelfEl) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  shelfEl.scrollIntoView({ block: 'start', behavior: smooth && !reduce ? 'smooth' : 'auto' });
  const name = shelfEl.querySelector<HTMLElement>('.shelf-name');
  if (name) {
    name.tabIndex = -1;
    name.focus({ preventScroll: true });
  }
}

function route() {
  if (!app || !ready) return;
  const a = app;
  const brand = parseBrandRoute(location.hash, brandsOf(a));
  const { racquetId, colourway } = brand ? { racquetId: null, colourway: null } : parseRoute(location.hash);
  const r = racquetId ? a.catalog.racquets.find((x) => x.id === racquetId) : undefined;
  const p = racquetId && !r ? a.stockOrder.find((x) => x.id === racquetId) : undefined;
  const missing = racquetId && !r && !p ? `There is no racquet with the id “${racquetId}”. Here are the brands.` : '';
  notice.textContent = [missing, baseNotice].filter(Boolean).join(' ');
  const shelfId = brand ? parseShelfRoute(location.hash) : null;
  const sameFloor = !r && !p && !wall.hidden && a.brand === brand && wall.dataset.floor === (brand ? 'brand' : 'home');
  if (sameFloor) {
    // Only the shelf changed (the line index): scroll to it, no page transition.
    markSigns(a);
    scrollToShelf(shelfId, true);
    routed = true;
    return;
  }
  const change = () => {
    if (r || p) detail.dataset.brand = (r ?? p)!.brand;
    if (r) showDetail(a, r, colourway);
    else if (p) showPlaceholder(a, p);
    else {
      const floorChanged = a.brand !== brand || wall.dataset.floor !== (brand ? 'brand' : 'home');
      if (floorChanged) {
        a.brand = brand;
        renderFloor(a);
      }
      showWall(a);
      if (shelfId) scrollToShelf(shelfId, false);
      else if (floorChanged && !a.lastOpened) window.scrollTo(0, 0);
      document.title = brand ? `${brand} · ${baseTitle.split(':')[0]}` : baseTitle;
    }
    markSigns(a);
  };
  // The first render is the page loading, not a move between places: no transition.
  // Moving within a line changes the page in place, so there is nothing to transition between.
  if (routed && !(r && page?.lineage === r.lineage)) transition(change);
  else {
    settle();
    change();
  }
  routed = true;
}

function showWall(a: App) {
  if (!detail.hidden) {
    a.viewer?.detach();
    a.viewer?.clear();
    detail.hidden = true;
    detail.replaceChildren();
    page = null;
  }
  wall.hidden = false;
  document.body.dataset.view = 'wall';
  if (a.lastOpened) {
    const link = wall.querySelector<HTMLAnchorElement>(`.shelf-stage[data-family="${a.lastOpened}"], li[data-id="${a.lastOpened}"] .stock-row, li[data-id="${a.lastOpened}"] .stock-tag`);
    a.lastOpened = null;
    if (link && !link.closest('[hidden]')) {
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: 'nearest' });
    }
  }
}

function showDetail(a: App, r: Racquet, colourway: string | null = null) {
  const inPlace = page?.lineage === r.lineage;
  a.lastOpened = familyOf(a.catalog, r).id; // the wall shows the family, so return to its bay
  wall.hidden = true;
  detail.hidden = false;
  document.body.dataset.view = 'detail';
  document.title = `${r.model} · ${baseTitle.split(':')[0]}`;
  detail.classList.toggle('arriving', !inPlace);
  if (inPlace && page) {
    // Another version, colour or generation of the racquet on show: scroll, focus and view stay put.
    updateDetail(a, page, r, colourway);
    announce.textContent = `Showing the ${r.model}.`;
    return;
  }
  detail.replaceChildren(...detailView(a, r, colourway));
  window.scrollTo(0, 0);
  detail.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}

function showPlaceholder(a: App, p: Placeholder) {
  page = null;
  a.viewer?.detach();
  a.viewer?.clear();
  a.lastOpened = p.id;
  wall.hidden = true;
  detail.hidden = false;
  document.body.dataset.view = 'detail';
  document.title = `${p.model} · ${baseTitle.split(':')[0]}`;
  detail.replaceChildren(...placeholderView(a, p));
  window.scrollTo(0, 0);
  detail.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}

function placeholderView(a: App, p: Placeholder): Node[] {
  const i = a.stockOrder.indexOf(p);
  const prev = a.stockOrder[(i - 1 + a.stockOrder.length) % a.stockOrder.length];
  const next = a.stockOrder[(i + 1) % a.stockOrder.length];
  const nav = el('nav', { class: 'detail-nav', 'aria-label': 'Racquet' },
    el('a', { class: 'back', href: brandRoute(p.brand) }, icon('back'), `All ${p.brand}`),
    stepper({ href: routeFor(prev.id), name: prev.model }, { href: routeFor(next.id), name: next.model }),
  );
  const s = p.specs;
  const row = (label: string, value: Node | string | null, aside?: string) =>
    value === null ? null : el('div', { class: 'row' }, el('dt', {}, label), el('dd', {}, value, aside ? el('span', { class: 'aside' }, aside) : null));
  const head = s.headSizeSqIn ? formatHeadSize(s.headSizeSqIn) : null;
  const len = s.lengthIn ? formatLength(s.lengthIn) : null;
  const specs = el('dl', { class: 'rows' },
    row('Head size', head?.primary ?? null, head?.secondary),
    row('Length', len?.primary ?? null, len?.secondary),
    row('String pattern', s.stringPattern ? formatPattern(s.stringPattern) : null, 'mains × crosses'),
    row('Beam', s.beamMm ? formatBeam(s.beamMm) : null, s.beamMm && new Set(s.beamMm).size > 1 ? 'as listed by the retailer' : undefined),
    row('Weight', s.unstrungWeightG ? `${formatCount(s.unstrungWeightG)} g` : null, 'unstrung'),
    row('Balance', s.balanceMm ? `${formatCount(s.balanceMm)} mm` : null, 'unstrung'),
    row('Colourway', p.colourway),
    row('Released', p.releaseYear ? String(p.releaseYear) : null),
    row('On sale in', p.onSaleIn.join(', ')),
    row('Category', p.category === 'junior' ? 'Junior' : 'Adult'),
  );
  const stage = el('div', { class: 'stage stage-empty', 'data-state': 'flat', style: '--swatch: var(--rail)' },
    silhouette(s.headSizeSqIn ?? 100),
    el('p', { class: 'stage-note' }, 'No 3D model yet.'),
  );
  const sheet = el('div', { class: 'sheet' },
    el('h1', { class: 'sheet-title', tabindex: '-1' }, p.model),
    el('p', { class: 'sheet-sub' }, [p.brand, placeholderLabel(p)].filter(Boolean).join(' · ')),
    el('p', { class: 'sheet-note' }, `Researched ${p.researched} from retailer listings and not yet modelled. Nothing to download. Specs are unverified; blanks were not found.`),
    el('h2', { class: 'sheet-head' }, 'Specs'),
    specs,
    el('h2', { class: 'sheet-head' }, 'Sources'),
    el('ul', { class: 'sources', role: 'list' }, ...p.sources.map((u) => el('li', {}, el('a', { href: u, rel: 'noreferrer' }, sourceLabel(u))))),
  );
  return [nav, el('div', { class: 'detail-body' }, stage, sheet)];
}

/** "tennis-warehouse.com", or "tennis-warehouse.com, archived 2023" for a Wayback Machine capture. */
function sourceLabel(u: string): string {
  const host = (x: string) => new URL(x).hostname.replace(/^www\./, '');
  const m = /^https?:\/\/web\.archive\.org\/web\/(\d{4})\d*[a-z_]*\/(https?:\/\/.+)$/.exec(u);
  try {
    return m ? `${host(m[2])}, archived ${m[1]}` : host(u);
  } catch {
    return u;
  }
}

// ---------- detail ----------

interface Stage {
  node: HTMLElement;
  /** Put another racquet of the line on the stage, at the same angle and zoom. False when it cannot. */
  update(r: Racquet): boolean;
}
interface Sheet {
  node: HTMLElement;
  family: Racquet;
  update(base: Racquet, r: Racquet, colourway: string | null): void;
}
/** The racquet page on show. Moving between versions of its line changes it in place. */
interface Page {
  lineage: string;
  body: HTMLElement;
  file: HTMLElement;
  stage: Stage;
  sheet: Sheet;
}
let page: Page | null = null;

function detailView(a: App, base: Racquet, colourwayId: string | null = null): Node[] {
  const family = familyOf(a.catalog, base);
  const { shown: r, colourway } = inColourway(base, colourwayId);
  const onWall = a.order.some((x) => x.lineage === base.lineage);
  const { prev, next } = neighboursOf(onWall ? a.order : wallGroups(a.catalog, 'all', true).flatMap((g) => g.racquets), base);
  const file = el('div', { class: 'detail-file' }, ...getFile(a, r));
  const nav = el('nav', { class: 'detail-nav', 'aria-label': 'Racquet' },
    el('a', { class: 'back', href: brandRoute(base.brand) }, icon('back'), `All ${base.brand}`),
    stepper({ href: routeFor(prev.id), name: stepName(prev, base.brand) }, { href: routeFor(next.id), name: stepName(next, base.brand) }),
    file,
  );
  const stageView = stage(a, r);
  const sheetView = sheet(a, family, base, r, colourway);
  const body = el('div', { class: 'detail-body', style: `--swatch: ${r.swatch}` }, stageView.node, sheetView.node);
  page = { lineage: base.lineage, body, file, stage: stageView, sheet: sheetView };
  warmVersions(a, family);
  return [nav, body];
}

function updateDetail(a: App, p: Page, base: Racquet, colourwayId: string | null): void {
  const family = familyOf(a.catalog, base);
  const { shown: r, colourway } = inColourway(base, colourwayId);
  p.body.style.setProperty('--swatch', r.swatch);
  p.file.replaceChildren(...getFile(a, r));
  if (!p.stage.update(r)) {
    const fresh = stage(a, r);
    p.stage.node.replaceWith(fresh.node);
    p.stage = fresh;
  }
  if (p.sheet.family === family) {
    p.sheet.update(base, r, colourway);
    return;
  }
  // Another generation has its own versions and write-up; keep focus on the tab just chosen.
  const onTab = !!document.activeElement?.closest('.sheet-sub');
  const fresh = sheet(a, family, base, r, colourway);
  p.sheet.node.replaceWith(fresh.node);
  p.sheet = fresh;
  if (onTab) fresh.node.querySelector<HTMLElement>('.gen-tab[aria-current="true"]')?.focus({ preventScroll: true });
  warmVersions(a, family);
}

/** Quietly bring every version's file in, so choosing one never waits on the network. */
function warmVersions(a: App, family: Racquet): void {
  const warm = () => membersOf(a.catalog, family, 'all').forEach((r) => {
    const asset = assetFor(r, a.style.id);
    if (asset) void fetchModelBytes(assetUrl(BASE, asset.path), 'low').catch(() => {});
  });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 800);
}

/** Previous and next, each with the name of where it goes. */
function stepper(prev: { href: string; name: string }, next: { href: string; name: string }): HTMLElement {
  return el('div', { class: 'stepper', role: 'group', 'aria-label': 'Previous and next racquet' },
    el('a', { class: 'step-prev', href: prev.href, 'aria-label': `Previous: ${prev.name}` }, icon('prev'), el('span', { class: 'stepper-name' }, prev.name)),
    el('a', { class: 'step-next', href: next.href, 'aria-label': `Next: ${next.name}` }, el('span', { class: 'stepper-name' }, next.name), icon('next')),
  );
}

/** Other generations of the line, newest first; each links to the same size where it exists. */
function generationPicker(a: App, family: Racquet): { node: HTMLElement; update(current: Racquet): void } | null {
  const gens = generationsOf(a.catalog, family);
  if (gens.length < 2) return null;
  const links = gens.map((g) => el('a', { class: 'gen-tab', 'aria-current': String(g.id === family.id) }, generationShort(g)));
  return {
    node: el('div', { class: 'gen-tabs', role: 'group', 'aria-label': 'Generation' }, ...links),
    update(current) {
      gens.forEach((g, i) => (links[i].href = routeFor(g.variants?.find((v) => v.label === current.variantLabel)?.id ?? g.id)));
    },
  };
}

/** Swatches for a racquet that comes in one version; a line-up carries its own. */
function colourwayPicker(r: Racquet): { node: HTMLElement; update(colourway: string | null): void } | null {
  if (!r.colourways?.length) return null;
  const options = [{ id: null as string | null, name: r.colourway ?? 'Standard', swatch: r.swatch }, ...r.colourways];
  const links = options.map((o) =>
    el('a', { class: 'colourway', href: routeFor(r.id, o.id), style: `--chip: ${o.swatch}` },
      el('span', { class: 'colourway-chip', 'aria-hidden': 'true' }), o.name));
  return {
    node: el('div', { class: 'colourways', role: 'group', 'aria-label': 'Colourway' }, ...links),
    update(colourway) {
      options.forEach((o, i) => links[i].setAttribute('aria-current', String(o.id === colourway)));
    },
  };
}

function stage(a: App, r: Racquet): Stage {
  const asset = assetFor(r, a.style.id);
  const hintId = 'stage-hint';
  const host = el('div', { class: 'stage', 'data-state': 'loading', style: 'view-transition-name: racquet' }, silhouette(r.specs.headSizeSqIn));

  if (a.viewer === undefined && a.thumbs && a.gl) {
    a.viewer = a.gl.Viewer.create();
    a.viewer?.setLook(a.look);
  }
  const viewer = a.viewer;
  if (!viewer || !asset) {
    // Coming from another detail view: stop drawing the previous racquet.
    viewer?.detach();
    viewer?.clear();
    host.dataset.state = 'flat';
    host.append(el('p', { class: 'stage-note' }, viewer ? 'No 3D file for this style.' : 'The 3D preview needs WebGL. Specs and the download still work.'));
    return { node: host, update: () => false };
  }

  host.setAttribute('tabindex', '0');
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', `3D view of the ${r.model}`);
  host.setAttribute('aria-describedby', hintId);
  host.addEventListener('keydown', (e) => {
    if (viewer.key(e)) e.preventDefault();
  });

  const reset = el('button', { class: 'button button-quiet', type: 'button' }, icon('reset'), 'Reset view');
  reset.addEventListener('click', () => viewer.reset());
  const retry = el('button', { class: 'button', type: 'button' }, icon('retry'), 'Retry');
  const fault = el('div', { class: 'stage-fault', hidden: true }, el('p', {}, 'The model did not load.'), retry);
  const controls = el('div', { class: 'stage-controls' },
    reset,
    lookControl(a),
    el('p', { class: 'stage-hint', id: hintId },
      el('span', { class: 'hint-fine' }, 'Drag to turn. Scroll to zoom. Arrow keys and + / − work too.'),
      el('span', { class: 'hint-coarse' }, 'Swipe sideways to turn. Pinch to zoom.'),
    ),
  );
  host.append(fault, controls);

  let url = assetUrl(BASE, asset.path);
  // With a racquet already standing here, it stays until the next one is ready to take its place.
  const load = (keepView: boolean) => {
    const wanted = url;
    if (!keepView) host.dataset.state = 'loading';
    fault.hidden = true;
    viewer.show(wanted, keepView).then(
      () => {
        if (wanted === url) host.dataset.state = 'ready';
      },
      () => {
        if (wanted !== url) return; // a newer choice won
        host.dataset.state = 'failed';
        fault.hidden = false;
      },
    );
  };
  retry.addEventListener('click', () => {
    host.focus(); // the button hides as loading starts; keep focus on the 3D view
    load(false);
  });
  viewer.attach(host);
  load(false);
  return {
    node: host,
    update(next) {
      const to = assetFor(next, a.style.id);
      if (!to) return false;
      host.setAttribute('aria-label', `3D view of the ${next.model}`);
      url = assetUrl(BASE, to.path);
      load(host.dataset.state === 'ready');
      return true;
    },
  };
}

/** The file's absolute URL and a loader snippet, each with a copy button. */
function useInCode(r: Racquet, path: string): HTMLElement[] {
  const url = new URL(assetUrl(BASE, path), location.href).href;
  const snippet = `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';\n\nconst loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);\nconst gltf = await loader.loadAsync(\n  '${url}',\n);\nscene.add(gltf.scene);`;
  const copyable = (text: string, label: string, block: boolean) => {
    const button = el('button', { class: 'copy', type: 'button', 'aria-label': `Copy ${label}` }, 'Copy');
    button.addEventListener('click', () => {
      void navigator.clipboard?.writeText(text).then(() => {
        button.textContent = 'Copied';
        setTimeout(() => (button.textContent = 'Copy'), 1500);
      });
    });
    return el('div', { class: block ? 'code code-block' : 'code' }, el(block ? 'pre' : 'span', {}, el('code', {}, text)), button);
  };
  return [
    el('h2', { class: 'sheet-head' }, 'Use in code'),
    el('p', { class: 'sheet-note' }, 'Load this exact racquet straight from the library. Id: ', el('code', {}, r.id), '. Every file is listed in ',
      el('a', { href: assetUrl(BASE, 'catalog.json') }, 'catalog.json'), ' under files.'),
    copyable(url, 'file URL', false),
    copyable(snippet, 'three.js snippet', true),
  ];
}

/** The nav's one button and the dialog it opens: the download, loading it in code, file facts and part names. */
function getFile(a: App, r: Racquet): HTMLElement[] {
  const asset = assetFor(r, a.style.id);
  const name = asset ? fileNameFromPath(asset.path) : null;
  if (!asset || !name) return [];
  const row = (label: string, value: string, aside?: string) =>
    el('div', { class: 'row' }, el('dt', {}, label), el('dd', {}, value, aside ? el('span', { class: 'aside' }, aside) : null));
  const dev = el('dialog', { class: 'dev', 'aria-labelledby': 'dev-title' });
  const close = el('button', { class: 'dev-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => dev.close());
  dev.addEventListener('click', (e) => { if (e.target === dev) dev.close(); }); // backdrop click
  dev.append(
    el('div', { class: 'dev-bar' }, el('h2', { id: 'dev-title', class: 'dev-title' }, `Get the ${r.model}`), close),
    el('div', { class: 'dev-body' },
      el('a', { class: 'download', href: assetUrl(BASE, asset.path), download: name },
        icon('download'),
        el('span', { class: 'download-label' }, `Download .${a.style.extension}`, el('span', { class: 'download-name' }, name)),
        el('span', { class: 'download-size' }, formatBytes(asset.bytes)),
      ),
      ...useInCode(r, asset.path),
      el('h2', { class: 'sheet-head' }, 'File'),
      el('dl', { class: 'rows' },
        row('Style', a.style.label),
        row('Format', `.${a.style.extension}`),
        row('Triangles', formatCount(asset.triangles)),
        row('Size', formatBytes(asset.bytes), `${formatCount(asset.bytes)} bytes`),
      ),
      el('h2', { class: 'sheet-head' }, 'Parts'),
      el('p', { class: 'sheet-note' }, 'Node names inside the file, for swapping or restyling parts in code.'),
      el('ul', { class: 'parts', role: 'list' }, ...r.parts.map((p) => el('li', {}, el('code', {}, p)))),
    ),
  );
  const open = el('button', { class: 'dev-open', type: 'button', 'aria-haspopup': 'dialog' }, icon('download'), el('span', {}, 'Download'));
  open.addEventListener('click', () => dev.showModal());
  return [open, dev];
}

/** The spec rows of the racquet on show. A family keeps the same rows from version to version. */
function specRows(r: Racquet, listsWeight: boolean): HTMLElement[] {
  const s = r.specs;
  const head = formatHeadSize(s.headSizeSqIn);
  const len = formatLength(s.lengthIn);
  const row = (label: string, value: Node | string, aside?: string | null) =>
    el('div', { class: 'row' }, el('dt', {}, label), el('dd', {}, value, aside ? el('span', { class: 'aside' }, aside) : null));
  return [
    row('Head size', head.primary, head.secondary),
    row('Length', len.primary, len.secondary),
    row('String pattern', formatPattern(s.stringPattern), 'mains × crosses'),
    row('Beam', formatBeam(s.beamMm), new Set(s.beamMm).size > 1 ? 'tip / middle / shaft' : undefined),
    ...(s.unstrungWeightG ? [row('Weight', `${formatCount(s.unstrungWeightG)} g`, 'unstrung')] : listsWeight ? [row('Weight', 'Not listed')] : []),
    row('Base colour', el('span', { class: 'chip-row' }, el('span', { class: 'chip', 'aria-hidden': 'true' }), r.swatch), r.colourway),
  ];
}

/** `base` is the page's racquet; `r` is it in the chosen colourway. */
function sheet(a: App, family: Racquet, base: Racquet, r: Racquet, colourway: string | null): Sheet {
  const isFamily = !!family.variants?.length;
  const listsWeight = membersOf(a.catalog, family, 'all').some((x) => x.specs.unstrungWeightG);
  const generations = generationPicker(a, family);
  const lineup = lineupView(a.catalog, family);
  const colours = lineup ? null : colourwayPicker(family);
  const picker = lineup?.node ?? colours?.node;
  const sub = el('span');
  const specsHead = el('h2', { class: 'sheet-head' });
  const specs = el('dl', { class: 'rows' });
  const profileSlot = el('div', { class: 'profile-slot' });

  const update: Sheet['update'] = (base, r, colourway) => {
    sub.textContent = [r.brand, generations ? null : generationLabel(r), isFamily ? null : r.colourway].filter(Boolean).join(' · ');
    generations?.update(base);
    lineup?.select(base, colourway);
    colours?.update(colourway);
    specsHead.textContent = isFamily ? `${r.model} specs` : 'Specs';
    specs.replaceChildren(...specRows(r, listsWeight));
    // The write-up is about the family's adult frame, so a junior size inside the family goes without.
    profileSlot.hidden = isJunior(base) && !isJunior(family);
  };
  update(base, r, colourway);

  void loadProfiles().then((profiles) => {
    const p = profiles.get(family.id);
    if (!p || !profileSlot.isConnected) return;
    lineup?.setNotes(p.variantNotes ?? {});
    const byId = new Map(a.catalog.racquets.map((x) => [x.id, x]));
    // Rivals are the profile's closest alternatives that this library has a page for and a profile of.
    const rivals: Rival[] = p.compared.flatMap((id) => {
      const x = byId.get(id);
      const rp = profiles.get(id);
      return x && rp ? [{ id, name: x.model, href: routeFor(x.id), profile: rp }] : [];
    });
    profileSlot.append(profileView(p, rivals, isFamily ? { name: lineageName(family), rated: family.variantLabel ?? family.model } : null));
  });

  // The page is the family's: its name and write-up stay put, and the line-up says which version is on show.
  const node = el('div', { class: 'sheet' },
    el('h1', { class: 'sheet-title', tabindex: '-1' }, isFamily ? lineageName(family) : family.model),
    el('div', { class: 'sheet-sub' }, sub, generations?.node),
    picker ? el('div', { class: 'pickers' }, picker) : null,
    profileSlot,
    specsHead,
    specs,
  );
  return { node, family, update };
}

// ---------- search ----------

const searchDialog = $<HTMLDialogElement>('search');
const searchInput = $<HTMLInputElement>('search-input');
const searchList = $<HTMLUListElement>('search-results');
const searchEmpty = $<HTMLParagraphElement>('search-empty');
const searchOpen = $<HTMLButtonElement>('search-open');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$<HTMLElement>('search-key').textContent = isMac ? '⌘K' : 'Ctrl K';
let searchActive = -1;

function openSearch() {
  if (!app || searchDialog.open) return;
  searchDialog.showModal();
  searchInput.select();
  renderSearch();
}

function renderSearch() {
  if (!app) return;
  const q = searchInput.value.trim();
  const hits = searchRacquets(app.catalog, q);
  searchActive = hits.length ? 0 : -1;
  searchList.replaceChildren(...hits.map((h, i) =>
    el('li', { id: `search-hit-${i}`, role: 'option', 'aria-selected': String(i === 0) },
      el('a', { class: 'search-hit', href: routeFor(h.id), tabindex: '-1' },
        el('span', { class: 'search-model' }, h.model),
        el('span', { class: 'search-meta' }, [h.brand, h.meta].filter(Boolean).join(' · ')),
        el('span', { class: 'search-badge' }, [h.junior ? 'Junior' : '', h.hasModel ? '3D' : 'No model yet'].filter(Boolean).join(' · ')),
      ),
    ),
  ));
  searchInput.setAttribute('aria-expanded', String(hits.length > 0));
  searchInput.setAttribute('aria-activedescendant', hits.length ? 'search-hit-0' : '');
  searchEmpty.textContent = !q ? 'Type a brand, model or year.' : hits.length ? '' : `No racquet matches “${q}”.`;
}

function moveSearch(step: number) {
  const items = searchList.children;
  if (!items.length) return;
  items[searchActive]?.setAttribute('aria-selected', 'false');
  searchActive = (searchActive + step + items.length) % items.length;
  const item = items[searchActive];
  item.setAttribute('aria-selected', 'true');
  searchInput.setAttribute('aria-activedescendant', item.id);
  item.scrollIntoView({ block: 'nearest' });
}

searchOpen.addEventListener('click', openSearch);
searchInput.addEventListener('input', renderSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    moveSearch(e.key === 'ArrowDown' ? 1 : -1);
  } else if (e.key === 'Enter') {
    const link = searchList.children[searchActive]?.querySelector('a');
    if (link) {
      e.preventDefault();
      searchDialog.close();
      location.hash = link.getAttribute('href')!;
    }
  }
});
searchList.addEventListener('click', (e) => {
  if ((e.target as Element).closest('a')) searchDialog.close();
});
// A click on the backdrop (the dialog element itself, outside its content) closes it.
searchDialog.addEventListener('click', (e) => {
  if (e.target === searchDialog) searchDialog.close();
});
searchDialog.addEventListener('close', () => searchOpen.focus({ preventScroll: true }));

// ---------- sound ----------

const SPEAKER = (on: boolean) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5H4z" fill="currentColor"/>${
    on
      ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
      : '<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
  }</svg>`;
const soundButton = el('button', { class: 'sound-toggle', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Interface sounds', title: 'Interface sounds' });
const paintSound = () => {
  soundButton.innerHTML = SPEAKER(soundOn());
  soundButton.setAttribute('aria-pressed', String(soundOn()));
};
paintSound();
searchOpen.after(soundButton);
soundButton.addEventListener('click', () => void setSound(!soundOn()).then(paintSound));
if (storedSound()) void setSound(true).then(paintSound); // the synth loads lazily and plays nothing until a gesture

// Delegated, so every control has its sound without wiring each one.
document.addEventListener('pointerenter', (e) => {
  const aisleLink = (e.target as Element).closest?.('.aisle-link');
  if (aisleLink && e.target === aisleLink) play('swish');
}, true);
document.addEventListener('click', (e) => {
  const t = e.target as Element;
  if (t.closest('.shelf-stage, .aisle-link, .lineup-row, .lineup-open, .stock-row, .stock-tag')) play('open');
  else if (t.closest('.back, .stepper a')) play('back');
  else if (t.closest('.sign, .gen-tab')) play('pick');
});

// Versions, colours and generations switch inside the click itself. Left to the link, the switch
// would wait for `hashchange`, which comes late and unevenly when clicks come quickly. The address
// and Back work as before; opening in a new tab is left to the browser.
detail.addEventListener('click', (e) => {
  const link = (e.target as Element).closest<HTMLAnchorElement>('.version, .sheet .colourway, .sheet-sub .gen-tab');
  const href = link?.getAttribute('href');
  if (!href || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (href === location.hash) return;
  history.pushState(null, '', href);
  route();
});
window.addEventListener('hashchange', route);
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (searchDialog.open) searchDialog.close();
    else openSearch();
    return;
  }
  if (searchDialog.open) return; // Escape closes the dialog, not the detail view
  if (e.key === 'Escape' && !detail.hidden && !e.defaultPrevented) location.hash = detail.dataset.brand ? brandRoute(detail.dataset.brand) : routeFor(null);
});
void boot();
