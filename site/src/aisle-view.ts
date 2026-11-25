// A floor's aisle: a brand's sign over a fan of what it sells, on a rail, and a tally. The whole aisle
// is the link. Racquets and strings walk the same floor, so both are built here. Pure DOM.
import { brandSlug } from './routes';
import { el } from './dom';

export interface Blade {
  swatch: string;
  /** What stands there until the render arrives, and without WebGL. */
  flat: SVGSVGElement;
  /** Have `canvas` drawn. `link` is what wakes it on hover and focus. */
  mount(blade: HTMLElement, canvas: HTMLCanvasElement, link: HTMLElement): void;
}

/** A hand of racquets, held at the butt caps. */
const HAND_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-9, 9],
  3: [-16, 0, 16],
  4: [-18, -6, 6, 18],
  5: [-21, -10.5, 0, 10.5, 21],
};

/** Spools stand stacked, as on a shop counter: [steps from the middle, row]. Left to right, so the fan's order holds. */
const STACK: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-0.5, 0], [0.5, 0]],
  3: [[-0.5, 0], [0, 1], [0.5, 0]],
  4: [[-1, 0], [-0.5, 1], [0, 0], [1, 0]],
  5: [[-1, 0], [-0.5, 1], [0, 0], [0.5, 1], [1, 0]],
};

export function aisleView(x: {
  brand: string;
  href: string;
  label: string;
  kind: 'racquets' | 'spools';
  /** Left to right, the one in the middle on top. */
  blades: Blade[];
  tally: Array<HTMLElement | null>;
}): HTMLLIElement {
  const slug = brandSlug(x.brand);
  const stack = STACK[x.blades.length] ?? STACK[5];
  const angles = HAND_ANGLES[x.blades.length] ?? HAND_ANGLES[5];
  const link = el('a', { class: 'aisle-link', href: x.href, 'aria-label': x.label });
  const fan = el('span', { class: `fan fan-${x.kind}`, 'data-count': String(x.blades.length), 'aria-hidden': 'true' });
  x.blades.forEach((b, i) => {
    const canvas = el('canvas', { class: 'bay-canvas' });
    const off = i - (x.blades.length - 1) / 2;
    // Centre blade on top; the fans open aisle by aisle, centre out.
    const r1 = (n: number) => (Math.random() - 0.5) * 2 * n;
    // A degree or two of play, and its own beat, travel and sway: the hand never reads as copies.
    const blade = el('span', { class: 'blade', style: `--a: ${(angles[i] + r1(1.6)).toFixed(2)}deg; --x: ${stack[i][0]}; --row: ${stack[i][1]}; --i: ${off}; --k: ${Math.round(Math.abs(off) * 2)}; z-index: ${10 - Math.round(Math.abs(off) * 2)}; --swatch: ${b.swatch}; --delay: ${Math.round(Math.abs(off) * 90 + Math.random() * 140)}ms; --dur: ${Math.round(820 + Math.random() * 420)}ms; --sway: ${(6 + Math.random() * 4).toFixed(1)}s; --sway-delay: ${(-Math.random() * 6).toFixed(1)}s` },
      el('span', { class: 'bay-stage' }, b.flat, canvas));
    fan.append(blade);
    b.mount(blade, canvas, link);
  });
  const centre = x.blades[Math.floor(x.blades.length / 2)];
  link.append(
    // The morph is named on the word itself, not the full-width sign: the boxes on both ends
    // must hug the lettering, or the snapshot scales by box width and overshoots the title.
    el('span', { class: 'aisle-sign' }, el('span', { class: 'aisle-name', style: `view-transition-name: brand-${slug}; view-transition-class: brand` }, x.brand)),
    fan,
    el('span', { class: 'aisle-rail', style: `--swatch: ${centre?.swatch ?? 'var(--rail)'}` }),
    el('span', { class: 'aisle-tag' }, ...x.tally),
  );
  const item = el('li', { class: 'aisle', 'data-brand': x.brand }, link);
  openWhenSeen(item);
  return item;
}

/** Open an aisle's fan when it scrolls into view and what stands in it has arrived (or a moment has passed). */
function openWhenSeen(item: HTMLElement) {
  const open = () => {
    item.dataset.open = '';
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
