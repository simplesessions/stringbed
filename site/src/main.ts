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
  olderCount,
  isJunior,
  generationsOf,
  generationShort,
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
  type Placeholder,
  type Racquet,
  type StockGroup,
  type Style,
} from './catalog-view';
import { el, icon, silhouette } from './dom';
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
  /** Show families that a newer generation of their line has replaced. */
  older: boolean;
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
  const older = storedOlder();
  const groups = wallGroups(catalog, age, older);
  const stock = groupPlaceholders(catalog);
  app = {
    catalog,
    style,
    groups,
    order: groups.flatMap((g) => g.racquets),
    stock,
    stockOrder: stock.flatMap((g) => g.years.flatMap((y) => y.items)),
    older,
    brand: null,
    age,
    look: storedLook(),
    gl: null,
    thumbs: null,
    viewer: undefined,
    lastOpened: null,
  };
  const a = app;
  buildHeader(a);
  buildWall(a);
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
  for (const g of a.groups) counts.set(g.brand, g.racquets.length);
  for (const g of groupPlaceholders(a.catalog, a.age)) counts.set(g.brand, (counts.get(g.brand) ?? 0) + g.count);
  return counts;
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
      if (a.brand && !brandCounts(a).has(a.brand)) a.brand = null; // the brand has nothing in this size
      renderSigns(a);
      buildWall(a);
      announceShown(a);
      if (parseRoute(location.hash).racquetId) location.hash = routeFor(null);
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
  const buttons: HTMLButtonElement[] = [];
  const add = (brand: string | null, label: string, count: number) => {
    const b = el('button', { class: 'sign', type: 'button', 'aria-pressed': String(brand === a.brand) },
      el('span', {}, label), el('span', { class: 'sign-count' }, String(count)));
    b.addEventListener('click', () => {
      a.brand = brand;
      a.lastOpened = null; // a filter choice is a new place on the wall; don't jump to the old bay
      for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
      applyFilter(a);
      announceShown(a);
      if (parseRoute(location.hash).racquetId) location.hash = routeFor(null);
    });
    buttons.push(b);
  };
  add(null, 'All', n);
  for (const b of brands) add(b, b, counts.get(b)!);
  signs.replaceChildren(...buttons);

  // Styles come from the catalog. With a single style there is nothing to switch.
  if (a.catalog.styles.length > 1) {
    const links = a.catalog.styles.map((s) =>
      el('a', { class: 'sign', href: `?style=${encodeURIComponent(s.id)}${location.hash}`, 'aria-current': s.id === a.style.id ? 'true' : null }, s.label),
    );
    signs.append(el('span', { class: 'signs-break', 'aria-hidden': 'true' }), ...links);
  }
}

const OLDER_KEY = 'stringbed.older';
function storedOlder(): boolean {
  try {
    return localStorage.getItem(OLDER_KEY) === '1';
  } catch {
    return false;
  }
}

/** Recompute what the wall shows after the size or the older-generations choice changed. */
function regroup(a: App) {
  a.groups = wallGroups(a.catalog, a.age, a.older);
  a.order = a.groups.flatMap((g) => g.racquets);
}

function applyFilter(a: App) {
  for (const section of wall.querySelectorAll<HTMLElement>('.section')) {
    section.hidden = a.brand !== null && section.dataset.brand !== a.brand;
  }
  wall.querySelector('.stock')?.replaceWith(...stockList(a));
  wall.classList.toggle('is-filtered', a.brand !== null);
}

// ---------- wall ----------

function buildWall(a: App) {
  const sections = a.groups.map((g) => {
    const id = `brand-${g.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return el('section', { class: 'section', 'data-brand': g.brand, 'aria-labelledby': id },
      el('h2', { class: 'section-sign', id }, g.brand),
      el('ul', { class: 'bays', role: 'list' }, ...g.racquets.map((r) => bay(a, r))),
    );
  });
  wall.replaceChildren(el('h1', { class: 'sr-only' }, 'All racquets'), ...sections, olderToggle(a), el('section', { class: 'stock' }));
  a.thumbs?.prune();
  wall.setAttribute('aria-busy', 'false');
  applyFilter(a);
}

/** Older generations stay off the wall unless asked for: one button under the frames. */
function olderToggle(a: App): HTMLElement {
  const n = olderCount(a.catalog, a.age);
  if (n === 0 && !a.older) return el('span', { hidden: true });
  const b = el('button', { class: 'button older-toggle', type: 'button', 'aria-pressed': String(a.older) },
    a.older ? 'Hide older generations' : `Show ${n} older generation${n === 1 ? '' : 's'}`);
  b.addEventListener('click', () => {
    a.older = !a.older;
    try {
      localStorage.setItem(OLDER_KEY, a.older ? '1' : '0');
    } catch {
      /* private mode */
    }
    regroup(a);
    renderSigns(a);
    buildWall(a);
    announceShown(a);
    wall.querySelector<HTMLButtonElement>('.older-toggle')?.focus({ preventScroll: true });
  });
  return el('div', { class: 'older' }, b);
}

/** Researched racquets with no model yet: a plain list under the wall, one column per brand. */
function stockList(a: App): HTMLElement[] {
  const stock = groupPlaceholders(a.catalog, a.age).filter((g) => a.brand === null || g.brand === a.brand);
  if (stock.length === 0) return [el('section', { class: 'stock', hidden: true })];
  const total = stock.reduce((n, g) => n + g.count, 0);
  const brand = (g: StockGroup) =>
    el('section', { class: 'stock-brand', 'data-brand': g.brand, 'aria-label': `${g.brand}, no model yet` },
      el('h3', { class: 'stock-sign' }, g.brand, el('span', { class: 'sign-count' }, String(g.count))),
      ...g.years.flatMap((y) => [
        el('h4', { class: 'stock-year' }, y.year === CURRENT_YEAR ? 'Current' : `On sale in ${y.year}`),
        el('ul', { class: 'stock-rows', role: 'list' }, ...y.items.map((p) => stockRow(p, a.age === 'all'))),
      ]),
    );
  return [
    el('section', { class: 'stock', 'aria-labelledby': 'stock-title' },
      el('h2', { class: 'stock-title', id: 'stock-title' }, 'No model yet', el('span', { class: 'sign-count' }, String(total))),
      el('p', { class: 'stock-lede' }, 'Researched from retailer listings and not yet modelled. Specs are unverified and often incomplete.'),
      el('div', { class: 'stock-brands' }, ...stock.map(brand)),
    ),
  ];
}

const CURRENT_YEAR = 2026;

/** showSize: flag junior frames, needed only when adult and junior rows are mixed. */
function stockRow(p: Placeholder, showSize: boolean): HTMLLIElement {
  const s = p.specs;
  const facts = [s.headSizeSqIn ? `${s.headSizeSqIn} in²` : null, s.stringPattern ? formatPattern(s.stringPattern) : null].filter(Boolean).join(' · ');
  return el('li', { 'data-id': p.id },
    el('a', { class: 'stock-row', href: routeFor(p.id) },
      el('span', { class: 'stock-model' }, p.model, p.category === 'junior' && showSize ? el('span', { class: 'stock-flag' }, 'Junior') : null),
      el('span', { class: 'stock-meta' }, placeholderLabel(p)),
      el('span', { class: 'stock-facts' }, facts),
    ),
  );
}

function bay(a: App, r: Racquet): HTMLLIElement {
  const asset = assetFor(r, a.style.id);
  const canvas = el('canvas', { class: 'bay-canvas', 'aria-hidden': 'true' });
  const link = el('a', { class: 'bay-link', href: routeFor(r.id) },
    el('span', { class: 'bay-stage' }, silhouette(r.specs.headSizeSqIn), canvas),
    el('span', { class: 'tag' },
      el('span', { class: 'tag-model' }, a.age === 'junior' ? r.model : wallName(r)),
      el('span', { class: 'tag-meta' }, `${r.brand} · ${generationLabel(r)}`),
      a.age !== 'junior' && r.variants?.length ? el('span', { class: 'tag-variants' }, variantLabels(a, r)) : null,
    ),
  );
  const item = el('li', { class: 'bay', style: `--swatch: ${r.swatch}`, 'data-id': r.id }, link);

  if (!asset) {
    item.dataset.state = 'flat';
    return item;
  }
  const attach = (thumbs: Thumbnails | null) => {
    if (thumbs) watch(thumbs, item, link, canvas, r, asset.path);
    else item.dataset.state = 'flat';
  };
  if (glSettled) attach(a.thumbs);
  else pendingBays.push(attach);
  return item;
}

/** A family's sizes for the bay tag, leaving out juniors on the Adult wall. */
function variantLabels(a: App, r: Racquet): string {
  const byId = new Map(a.catalog.racquets.map((x) => [x.id, x]));
  return r.variants!.filter((v) => a.age !== 'adult' || !isJunior(byId.get(v.id) ?? r)).map((v) => v.label).join(' · ');
}

function watch(thumbs: Thumbnails, item: HTMLLIElement, link: HTMLAnchorElement, canvas: HTMLCanvasElement, r: Racquet, path: string) {
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

function route() {
  if (!app || !ready) return;
  const { racquetId, colourway } = parseRoute(location.hash);
  const r = racquetId ? app.catalog.racquets.find((x) => x.id === racquetId) : undefined;
  const p = racquetId && !r ? app.stockOrder.find((x) => x.id === racquetId) : undefined;
  const missing = racquetId && !r && !p ? `There is no racquet with the id “${racquetId}”. Here is the full lineup.` : '';
  notice.textContent = [missing, baseNotice].filter(Boolean).join(' ');
  if (r) showDetail(app, r, colourway);
  else if (p) showPlaceholder(app, p);
  else showWall(app);
}

function showWall(a: App) {
  if (!detail.hidden) {
    a.viewer?.detach();
    a.viewer?.clear();
    detail.hidden = true;
    detail.replaceChildren();
  }
  wall.hidden = false;
  document.body.dataset.view = 'wall';
  document.title = baseTitle;
  if (a.lastOpened) {
    const link = wall.querySelector<HTMLAnchorElement>(`.bay[data-id="${a.lastOpened}"] .bay-link, li[data-id="${a.lastOpened}"] .stock-row`);
    a.lastOpened = null;
    if (link && !link.closest('[hidden]')) {
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: 'nearest' });
    }
  }
}

function showDetail(a: App, r: Racquet, colourway: string | null = null) {
  // Switching colourway on the same racquet keeps the scroll position and focus where they are.
  const same = !detail.hidden && detail.dataset.id === r.id;
  detail.dataset.id = r.id;
  a.lastOpened = familyOf(a.catalog, r).id; // the wall shows the family, so return to its bay
  wall.hidden = true;
  detail.hidden = false;
  document.body.dataset.view = 'detail';
  document.title = `${r.model} · ${baseTitle.split(':')[0]}`;
  detail.replaceChildren(...detailView(a, r, colourway));
  if (same) {
    detail.querySelector<HTMLElement>('.colourway[aria-current="true"]')?.focus({ preventScroll: true });
    return;
  }
  window.scrollTo(0, 0);
  detail.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}

function showPlaceholder(a: App, p: Placeholder) {
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
    el('a', { class: 'back', href: routeFor(null) }, icon('back'), 'All racquets'),
    el('span', { class: 'stepper' },
      el('a', { href: routeFor(prev.id), 'aria-label': `Previous: ${prev.model}` }, icon('prev'), el('span', { class: 'stepper-name' }, prev.model)),
      el('a', { href: routeFor(next.id), 'aria-label': `Next: ${next.model}` }, el('span', { class: 'stepper-name' }, next.model), icon('next')),
    ),
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

function detailView(a: App, base: Racquet, colourwayId: string | null = null): Node[] {
  const family = familyOf(a.catalog, base);
  const order = a.order.includes(family) ? a.order : wallGroups(a.catalog, 'all', true).flatMap((g) => g.racquets);
  const i = Math.max(0, order.indexOf(family));
  const { shown: r, colourway } = inColourway(base, colourwayId);
  const prev = order[(i - 1 + order.length) % order.length];
  const next = order[(i + 1) % order.length];
  const nav = el('nav', { class: 'detail-nav', 'aria-label': 'Racquet' },
    el('a', { class: 'back', href: routeFor(null) }, icon('back'), 'All racquets'),
    el('span', { class: 'stepper' },
      el('a', { href: routeFor(prev.id), 'aria-label': `Previous: ${wallName(prev)}` }, icon('prev'), el('span', { class: 'stepper-name' }, wallName(prev))),
      el('a', { href: routeFor(next.id), 'aria-label': `Next: ${wallName(next)}` }, el('span', { class: 'stepper-name' }, wallName(next)), icon('next')),
    ),
  );
  const pickers = [generationPicker(a, family, base), ...variantPicker(a, family, base.id), colourwayPicker(base, colourway)].filter((x): x is HTMLElement => x !== null);
  return [nav, el('div', { class: 'detail-body', style: `--swatch: ${r.swatch}` }, stage(a, r), sheet(a, r, pickers.length ? el('div', { class: 'pickers' }, ...pickers) : null))];
}

/** Other generations of the line, newest first; each links to the same size where it exists. */
function generationPicker(a: App, family: Racquet, current: Racquet): HTMLElement | null {
  const gens = generationsOf(a.catalog, family);
  if (gens.length < 2) return null;
  const label = current.variantLabel;
  const target = (g: Racquet) => g.variants?.find((v) => v.label === label)?.id ?? g.id;
  return el('div', { class: 'variants generations', role: 'group', 'aria-label': 'Generation' },
    ...gens.map((g) => el('a', { class: 'variant', href: routeFor(target(g)), 'aria-current': String(g.id === family.id) }, generationShort(g))),
  );
}

/** The sizes or versions of a frame; none when it comes in one. */
function variantPicker(a: App, family: Racquet, current: string): HTMLElement[] {
  if (!family.variants?.length) return [];
  const byId = new Map(a.catalog.racquets.map((r) => [r.id, r]));
  const junior = (id: string) => isJunior(byId.get(id) ?? family);
  const row = (label: string, list: Array<{ id: string; label: string }>, rowName?: string) =>
    el('div', { class: 'variants', role: 'group', 'aria-label': label },
      rowName ? el('span', { class: 'variants-name' }, rowName) : null,
      ...list.map((v) => el('a', { class: 'variant', href: routeFor(v.id), 'aria-current': String(v.id === current) }, v.label)),
    );
  const adults = family.variants.filter((v) => !junior(v.id));
  const juniors = family.variants.filter((v) => junior(v.id)).sort((x, y) => x.label.localeCompare(y.label, 'en', { numeric: true }));
  // Juniors get their own row so a long list of junior sizes does not bury the adult ones.
  return [
    adults.length ? row('Version', adults) : null,
    juniors.length ? row('Junior sizes', juniors, 'Junior') : null,
  ].filter((x): x is HTMLDivElement => x !== null);
}

/** Swatches for a racquet's official colourways; none when it has only one. */
function colourwayPicker(r: Racquet, current: string | null): HTMLElement | null {
  if (!r.colourways?.length) return null;
  const options = [{ id: null as string | null, name: r.colourway ?? 'Standard', swatch: r.swatch }, ...r.colourways];
  return el('div', { class: 'colourways', role: 'group', 'aria-label': 'Colourway' },
    ...options.map((o) =>
      el('a', { class: 'colourway', href: routeFor(r.id, o.id), 'aria-current': String(o.id === current), style: `--chip: ${o.swatch}` },
        el('span', { class: 'colourway-chip', 'aria-hidden': 'true' }), o.name),
    ),
  );
}

function stage(a: App, r: Racquet): HTMLElement {
  const asset = assetFor(r, a.style.id);
  const hintId = `hint-${r.id}`;
  const host = el('div', { class: 'stage', 'data-state': 'loading' }, silhouette(r.specs.headSizeSqIn));

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
    return host;
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

  const load = () => {
    host.dataset.state = 'loading';
    fault.hidden = true;
    viewer.show(assetUrl(BASE, asset.path)).then(
      () => (host.dataset.state = 'ready'),
      () => {
        host.dataset.state = 'failed';
        fault.hidden = false;
      },
    );
  };
  retry.addEventListener('click', () => {
    host.focus(); // the button hides as loading starts; keep focus on the 3D view
    load();
  });
  viewer.attach(host);
  load();
  return host;
}

/** The file's absolute URL and a loader snippet, each with a copy button. */
function useInCode(r: Racquet, path: string): HTMLElement[] {
  const url = new URL(assetUrl(BASE, path), location.href).href;
  const snippet = `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\n\nconst gltf = await new GLTFLoader().loadAsync(\n  '${url}',\n);\nscene.add(gltf.scene);`;
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

function sheet(a: App, r: Racquet, picker: HTMLElement | null = null): HTMLElement {
  const s = r.specs;
  const head = formatHeadSize(s.headSizeSqIn);
  const len = formatLength(s.lengthIn);
  const row = (label: string, value: Node | string, aside?: string) =>
    el('div', { class: 'row' }, el('dt', {}, label), el('dd', {}, value, aside ? el('span', { class: 'aside' }, aside) : null));

  const specs = el('dl', { class: 'rows' },
    row('Head size', head.primary, head.secondary),
    row('Length', len.primary, len.secondary),
    row('String pattern', formatPattern(s.stringPattern), 'mains × crosses'),
    row('Beam', formatBeam(s.beamMm), new Set(s.beamMm).size > 1 ? 'tip / middle / shaft' : undefined),
    s.unstrungWeightG ? row('Weight', `${formatCount(s.unstrungWeightG)} g`, 'unstrung') : null,
    row('Base colour', el('span', { class: 'chip-row' }, el('span', { class: 'chip', 'aria-hidden': 'true' }), r.swatch)),
  );

  const asset = assetFor(r, a.style.id);
  const name = asset ? fileNameFromPath(asset.path) : null;
  const download = asset && name
    ? el('a', { class: 'download', href: assetUrl(BASE, asset.path), download: name },
        icon('download'),
        el('span', { class: 'download-label' }, `Download .${a.style.extension}`, el('span', { class: 'download-name' }, name)),
        el('span', { class: 'download-size' }, formatBytes(asset.bytes)),
      )
    : el('p', { class: 'sheet-note' }, `There is no ${a.style.label} file for this racquet yet.`);
  const file = asset
    ? [
        ...useInCode(r, asset.path),
        el('h2', { class: 'sheet-head' }, 'File'),
        el('dl', { class: 'rows' },
          row('Style', a.style.label),
          row('Format', `.${a.style.extension}`),
          row('Triangles', formatCount(asset.triangles)),
          row('Size', formatBytes(asset.bytes), `${formatCount(asset.bytes)} bytes`),
        ),
      ]
    : [];

  return el('div', { class: 'sheet' },
    el('h1', { class: 'sheet-title', tabindex: '-1' }, r.model),
    el('p', { class: 'sheet-sub' }, `${r.brand} · ${generationLabel(r)}${r.colourway ? ` · ${r.colourway}` : ''}`),
    picker,
    download,
    el('h2', { class: 'sheet-head' }, 'Specs'),
    specs,
    ...file,
    el('h2', { class: 'sheet-head' }, 'Parts'),
    el('p', { class: 'sheet-note' }, 'Node names inside the file, for swapping or restyling parts in code.'),
    el('ul', { class: 'parts', role: 'list' }, ...r.parts.map((p) => el('li', {}, el('code', {}, p)))),
  );
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

window.addEventListener('hashchange', route);
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (searchDialog.open) searchDialog.close();
    else openSearch();
    return;
  }
  if (searchDialog.open) return; // Escape closes the dialog, not the detail view
  if (e.key === 'Escape' && !detail.hidden && !e.defaultPrevented) location.hash = routeFor(null);
});
void boot();
