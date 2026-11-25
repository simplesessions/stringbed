import type { StringCatalog } from '../../src/catalog';
import { assetUrl } from './catalog-view';

let pending: Promise<StringCatalog> | null = null;

/** Fetch strings.json once; a failed load is forgotten so the next call retries. */
export function loadStrings(): Promise<StringCatalog> {
  if (!pending) {
    const p = (async () => {
      const res = await fetch(assetUrl(import.meta.env?.BASE_URL ?? '/', 'strings.json'));
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      const data = (await res.json().catch(() => {
        throw new Error('The strings file is not valid JSON.');
      })) as StringCatalog;
      if (!Array.isArray(data?.strings)) throw new Error('The strings file is not in the expected format.');
      return data;
    })();
    p.catch(() => {
      if (pending === p) pending = null;
    });
    pending = p;
  }
  return pending;
}

/** Test hook: forget any cached load. */
export function forgetStrings(): void {
  pending = null;
}
