// The gallery's one hash-route parser and its builders. Pure: no DOM, no three.js.

export type Route =
  | { kind: 'home' }
  | { kind: 'find'; query: string }
  | { kind: 'string-find'; query: string }
  | { kind: 'brand'; slug: string; lineage: string | null }
  | { kind: 'racquet'; id: string; colourway: string | null }
  | { kind: 'strings' }
  | { kind: 'string-brand'; slug: string }
  | { kind: 'string'; id: string; colour: string | null }
  | { kind: 'build'; id: string; colourway: string | null; query: string }; // query '' when none

export type StringsRoute = Extract<Route, { kind: 'strings' | 'string-brand' | 'string' | 'string-find' }>;
export const isStringsRoute = (r: Route): r is StringsRoute => r.kind === 'strings' || r.kind === 'string-brand' || r.kind === 'string' || r.kind === 'string-find';

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RACQUET = new RegExp(`^#/(${SLUG})(?:/(${SLUG}))?/?$`);
const BRAND = new RegExp(`^#/b/(${SLUG})(?:/(${SLUG}))?/?$`);
const STRING_BRAND = new RegExp(`^#/strings/b/(${SLUG})/?$`);
const STRING = new RegExp(`^#/strings/(${SLUG})(?:/(${SLUG}))?/?$`);
const FIND = /^#\/find\/?(?:\?(.*))?$/;
const STRING_FIND = /^#\/strings\/find\/?(?:\?(.*))?$/;
const BUILD = new RegExp(`^#/build/(${SLUG})(?:/(${SLUG}))?/?(?:\\?(.*))?$`);

/** Whole first segments that are never racquet ids. */
const RESERVED = /^#\/(strings|build|find)(\/|\?|$)/;

/** Reserved first segments (b, find, strings, build) are tried before the racquet pattern; anything unreadable is home. */
export function parseHash(hash: string): Route {
  let m: RegExpExecArray | null;
  if ((m = FIND.exec(hash))) return { kind: 'find', query: m[1] ?? '' };
  if ((m = STRING_FIND.exec(hash))) return { kind: 'string-find', query: m[1] ?? '' };
  if ((m = BRAND.exec(hash))) return { kind: 'brand', slug: m[1], lineage: m[2] ?? null };
  if ((m = STRING_BRAND.exec(hash))) return { kind: 'string-brand', slug: m[1] };
  if (/^#\/strings\/b\/?$/.test(hash) || /^#\/strings\/?$/.test(hash)) return { kind: 'strings' };
  if ((m = BUILD.exec(hash))) return { kind: 'build', id: m[1], colourway: m[2] ?? null, query: m[3] ?? '' };
  if ((m = STRING.exec(hash)) && m[1] !== 'b') return { kind: 'string', id: m[1], colour: m[2] ?? null };
  if (!RESERVED.test(hash) && (m = RACQUET.exec(hash))) return { kind: 'racquet', id: m[1], colourway: m[2] ?? null };
  return { kind: 'home' };
}

export function routeFor(id: string | null, colourway?: string | null): string {
  return id === null ? '#/' : colourway ? `#/${id}/${colourway}` : `#/${id}`;
}

export function brandSlug(brand: string): string {
  return brand.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** "#/b/<brand>" opens a brand's floor; "#/b/<brand>/<lineage>" opens it at that line's shelf. */
export function brandRoute(brand: string, lineage?: string | null): string {
  return lineage ? `#/b/${brandSlug(brand)}/${lineage}` : `#/b/${brandSlug(brand)}`;
}

/** `brand` is already a slug. */
export function stringsRoute(brand?: string | null): string {
  return brand ? `#/strings/b/${brand}` : '#/strings';
}

export function stringRoute(id: string, colour?: string | null): string {
  return colour ? `#/strings/${id}/${colour}` : `#/strings/${id}`;
}

/** The home floor with a filter on; with nothing picked, the home floor itself. */
export function findRoute(query: string): string {
  return query ? `#/find?${query}` : '#/';
}

export function stringFindRoute(query: string): string {
  return query ? `#/strings/find?${query}` : '#/strings';
}

export function buildRoute(id: string, colourway?: string | null, query = ''): string {
  return `#/build/${id}${colourway ? `/${colourway}` : ''}${query ? `?${query}` : ''}`;
}
