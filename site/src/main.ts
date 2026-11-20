import './styles.css';
import fontLicence from './fonts/OFL.txt?url';
import type { Catalog } from '../../src/catalog';
import {
  assetFor,
  assetUrl,
  fileNameFromPath,
  filterByBrand,
  formatBeam,
  formatBytes,
  formatCount,
  formatHeadSize,
  formatLength,
  formatPattern,
  generationLabel,
  groupByBrand,
  parseRoute,
  pickStyle,
  routeFor,
  type BrandGroup,
  type Racquet,
  type Style,
} from './catalog-view';
import { el, icon, silhouette } from './dom';
import type { Thumbnails, ThumbState, Viewer } from './gl';

const BASE = import.meta.env.BASE_URL;

type GL = typeof import('./gl');
// Start fetching the 3D code alongside the catalog; the page does not wait for it to list racquets.
const glModule: Promise<GL | null> = import('./gl').catch(() => null);
/** Bays waiting for the 3D code, so they can be wired up (or left flat) once it arrives. */
let pendingBays: Array<(thumbs: Thumbnails | null) => void> = [];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wall = $<HTMLDivElement>('wall');
const detail = $<HTMLElement>('detail');
const signs = $<HTMLElement>('signs');
const notice = $<HTMLParagraphElement>('notice');
const lede = $<HTMLParagraphElement>('lede');
const announce = $<HTMLParagraphElement>('announce');
const baseTitle = document.title;
$<HTMLAnchorElement>('font-licence').href = fontLicence;

interface App {
  catalog: Catalog;
  style: Style;
  groups: BrandGroup[];
  order: Racquet[];
  brand: string | null;
  gl: GL | null;
  thumbs: Thumbnails | null;
  viewer: Viewer | null | undefined; // undefined: not tried yet
  lastOpened: string | null;
}
let app: App | null = null;
/** False until the 3D code has settled; routing waits so a detail view never misreports WebGL. */
let ready = false;

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
  const groups = groupByBrand(catalog);
  app = {
    catalog,
    style,
    groups,
    order: groups.flatMap((g) => g.racquets),
    brand: null,
    gl: null,
    thumbs: null,
    viewer: undefined,
    lastOpened: null,
  };
  const a = app;
  buildHeader(a);
  buildWall(a);
  a.gl = await glModule;
  a.thumbs = a.gl?.Thumbnails.create() ?? null;
  for (const attach of pendingBays) attach(a.thumbs);
  pendingBays = [];
  ready = true;
  if (!a.gl) {
    notice.textContent = 'The 3D viewer did not load, so racquets show as colour silhouettes. Specs and downloads still work.';
  } else if (!a.thumbs) {
    notice.textContent = 'This browser is not giving the page WebGL, so racquets show as colour silhouettes. Specs and downloads still work.';
  }
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

function buildHeader(a: App) {
  const n = a.catalog.racquets.length;
  lede.textContent = `${n} tennis racquets as small 3D files, generated from data at one scale. Open one to turn it, read its specs and download it.`;

  const buttons: HTMLButtonElement[] = [];
  const add = (brand: string | null, label: string, count: number) => {
    const b = el('button', { class: 'sign', type: 'button', 'aria-pressed': String(brand === a.brand) },
      el('span', {}, label), el('span', { class: 'sign-count' }, String(count)));
    b.addEventListener('click', () => {
      a.brand = brand;
      for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
      applyFilter(a);
      const shown = filterByBrand(a.groups, brand).reduce((n, g) => n + g.racquets.length, 0);
      announce.textContent = brand ? `Showing ${shown} ${brand} racquets.` : `Showing all ${shown} racquets.`;
      if (parseRoute(location.hash).racquetId) location.hash = routeFor(null);
    });
    buttons.push(b);
  };
  add(null, 'All', n);
  for (const g of a.groups) add(g.brand, g.brand, g.racquets.length);
  signs.replaceChildren(...buttons);

  // Styles come from the catalog. With a single style there is nothing to switch.
  if (a.catalog.styles.length > 1) {
    const links = a.catalog.styles.map((s) =>
      el('a', { class: 'sign', href: `?style=${encodeURIComponent(s.id)}${location.hash}`, 'aria-current': s.id === a.style.id ? 'true' : null }, s.label),
    );
    signs.append(el('span', { class: 'signs-break', 'aria-hidden': 'true' }), ...links);
  }
  signs.hidden = false;
}

function applyFilter(a: App) {
  const shown = new Set(filterByBrand(a.groups, a.brand).map((g) => g.brand));
  for (const section of wall.querySelectorAll<HTMLElement>('.section')) {
    section.hidden = !shown.has(section.dataset.brand!);
  }
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
  wall.replaceChildren(el('h1', { class: 'sr-only' }, 'All racquets'), ...sections);
  wall.setAttribute('aria-busy', 'false');
  applyFilter(a);
}

function bay(a: App, r: Racquet): HTMLLIElement {
  const asset = assetFor(r, a.style.id);
  const canvas = el('canvas', { class: 'bay-canvas', 'aria-hidden': 'true' });
  const link = el('a', { class: 'bay-link', href: routeFor(r.id) },
    el('span', { class: 'bay-stage' }, silhouette(r.specs.headSizeSqIn), canvas),
    el('span', { class: 'tag' },
      el('span', { class: 'tag-model' }, r.model),
      el('span', { class: 'tag-meta' }, `${r.brand} · ${generationLabel(r)}`),
    ),
  );
  const item = el('li', { class: 'bay', style: `--swatch: ${r.swatch}`, 'data-id': r.id }, link);

  if (!asset) {
    item.dataset.state = 'flat';
    return item;
  }
  pendingBays.push((thumbs) => {
    if (thumbs) watch(thumbs, item, link, canvas, r, asset.path);
    else item.dataset.state = 'flat';
  });
  return item;
}

function watch(thumbs: Thumbnails, item: HTMLLIElement, link: HTMLAnchorElement, canvas: HTMLCanvasElement, r: Racquet, path: string) {
  const retry = el('button', { class: 'bay-retry', type: 'button' }, icon('retry'), 'Retry');
  retry.setAttribute('aria-label', `Retry loading the ${r.model} preview`);
  const fault = el('span', { class: 'bay-fault', hidden: true }, el('span', {}, 'Preview failed'), retry);
  item.append(fault);
  retry.addEventListener('click', () => thumbs.retry(canvas));
  thumbs.add(canvas, assetUrl(BASE, path), link, (state: ThumbState) => {
    item.dataset.state = state;
    fault.hidden = state !== 'failed';
  });
}

// ---------- routing ----------

function route() {
  if (!app || !ready) return;
  const { racquetId } = parseRoute(location.hash);
  const r = racquetId ? app.catalog.racquets.find((x) => x.id === racquetId) : undefined;
  if (racquetId && !r) {
    notice.textContent = `There is no racquet with the id “${racquetId}”. Here is the full lineup.`;
  } else if (app.thumbs) {
    notice.textContent = '';
  }
  if (r) showDetail(app, r);
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
    const link = wall.querySelector<HTMLAnchorElement>(`.bay[data-id="${a.lastOpened}"] .bay-link`);
    a.lastOpened = null;
    if (link && !link.closest('[hidden]')) {
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: 'nearest' });
    }
  }
}

function showDetail(a: App, r: Racquet) {
  a.lastOpened = r.id;
  wall.hidden = true;
  detail.hidden = false;
  document.body.dataset.view = 'detail';
  document.title = `${r.model} · ${baseTitle.split(':')[0]}`;
  detail.replaceChildren(...detailView(a, r));
  window.scrollTo(0, 0);
  detail.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}

// ---------- detail ----------

function detailView(a: App, r: Racquet): Node[] {
  const i = a.order.indexOf(r);
  const prev = a.order[(i - 1 + a.order.length) % a.order.length];
  const next = a.order[(i + 1) % a.order.length];
  const nav = el('nav', { class: 'detail-nav', 'aria-label': 'Racquet' },
    el('a', { class: 'back', href: routeFor(null) }, icon('back'), 'All racquets'),
    el('span', { class: 'stepper' },
      el('a', { href: routeFor(prev.id), 'aria-label': `Previous: ${prev.model}` }, icon('prev'), el('span', { class: 'stepper-name' }, prev.model)),
      el('a', { href: routeFor(next.id), 'aria-label': `Next: ${next.model}` }, el('span', { class: 'stepper-name' }, next.model), icon('next')),
    ),
  );
  return [nav, el('div', { class: 'detail-body', style: `--swatch: ${r.swatch}` }, stage(a, r), sheet(a, r))];
}

function stage(a: App, r: Racquet): HTMLElement {
  const asset = assetFor(r, a.style.id);
  const hintId = `hint-${r.id}`;
  const host = el('div', { class: 'stage', 'data-state': 'loading' }, silhouette(r.specs.headSizeSqIn));

  if (a.viewer === undefined && a.thumbs && a.gl) a.viewer = a.gl.Viewer.create();
  const viewer = a.viewer;
  if (!viewer || !asset) {
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
  retry.addEventListener('click', load);
  viewer.attach(host);
  load();
  return host;
}

function sheet(a: App, r: Racquet): HTMLElement {
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
    el('p', { class: 'sheet-sub' }, `${r.brand} · ${generationLabel(r)}`),
    download,
    el('h2', { class: 'sheet-head' }, 'Specs'),
    specs,
    ...file,
    el('h2', { class: 'sheet-head' }, 'Parts'),
    el('p', { class: 'sheet-note' }, 'Node names inside the file, for swapping or restyling parts in code.'),
    el('ul', { class: 'parts', role: 'list' }, ...r.parts.map((p) => el('li', {}, el('code', {}, p)))),
  );
}

window.addEventListener('hashchange', route);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !detail.hidden && !e.defaultPrevented) location.hash = routeFor(null);
});
void boot();
