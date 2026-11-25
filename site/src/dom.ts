// Small DOM helpers: element creation, the icon set, and the swatch silhouette placeholder.

type Attrs = Record<string, string | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'hidden' && v === true) node.hidden = true;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, cls: string, paths: Array<[string, Record<string, string>]>): SVGSVGElement {
  const root = document.createElementNS(SVG, 'svg');
  root.setAttribute('viewBox', viewBox);
  root.setAttribute('class', cls);
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  for (const [tag, attrs] of paths) {
    const p = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    root.append(p);
  }
  return root;
}

// One stroke family: 24 px grid, 1.75 stroke, round caps.
const ICONS = {
  back: 'M10.5 5.5L4 12l6.5 6.5M4 12h16',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  close: 'M6 6l12 12M18 6L6 18',
  full: 'M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5',
  retry: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  minus: 'M6 12h12',
  plus: 'M6 12h12M12 6v12',
  rise: 'M12 19V5M6 11l6-6 6 6',
  reset: 'M12 4.5a7.5 7.5 0 1 1-7.1 5.1M4.5 4.5v5h5',
} as const;

export function icon(name: keyof typeof ICONS): SVGSVGElement {
  return svg('0 0 24 24', 'icon', [['path', { d: ICONS[name], fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]]);
}

/**
 * A flat racquet outline in the entry's swatch colour: the loading state, the failed state
 * and the no-WebGL fallback. Proportions follow the 3D framing (27 in tall, 8% margin), with
 * the head width taken from the head size.
 */
export function silhouette(headSizeSqIn: number): SVGSVGElement {
  // viewBox units: the racquet is 92.6 tall (100 with the 8% framing margin).
  const scale = 92.6 / 27; // units per inch
  const headLen = 13.0 * Math.sqrt(headSizeSqIn / 100) * scale;
  const headWid = 10.2 * Math.sqrt(headSizeSqIn / 100) * scale;
  const top = 3.7;
  const cy = top + headLen / 2;
  const rx = (headWid / 2) * 0.93; // matches the slight resting turn of the 3D view
  const throatY = cy + headLen / 2;
  const shaftTop = throatY + 9;
  const bottom = 96.3;
  return svg('0 0 42 100', 'silhouette', [
    ['ellipse', { cx: '21', cy: cy.toFixed(2), rx: rx.toFixed(2), ry: (headLen / 2).toFixed(2), fill: 'none', stroke: 'var(--swatch)', 'stroke-width': '2.6' }],
    ['path', { d: `M${(21 - rx * 0.55).toFixed(2)} ${(throatY - 3).toFixed(2)} L19.6 ${shaftTop.toFixed(2)} M${(21 + rx * 0.55).toFixed(2)} ${(throatY - 3).toFixed(2)} L22.4 ${shaftTop.toFixed(2)}`, fill: 'none', stroke: 'var(--swatch)', 'stroke-width': '2.2', 'stroke-linecap': 'round' }],
    ['rect', { x: '19.4', y: shaftTop.toFixed(2), width: '3.2', height: (bottom - shaftTop).toFixed(2), rx: '1.2', fill: 'var(--swatch)' }],
  ]);
}

/**
 * A spool from the end, in its string's colour: the loading state, the failed state and the no-WebGL
 * fallback. As tall as the 3D framing draws a reel, and standing on the same line.
 */
export function disc(): SVGSVGElement {
  const ring = (r: number) => `M${50 - r} 58a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  return svg('0 0 100 100', 'silhouette disc', [
    ['path', { d: ring(37) + ring(10), fill: 'var(--swatch)', 'fill-rule': 'evenodd', stroke: 'oklch(0.23 0.01 75 / 0.25)', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }],
  ]);
}

/** Lines over a picture, in its own CSS pixels: each an outline with a lighter core. */
export function polylines(cls: string): { node: SVGSVGElement; set(lines: ReadonlyArray<{ kind: string; points: ReadonlyArray<readonly [number, number]> }>): void } {
  const node = document.createElementNS(SVG, 'svg');
  node.setAttribute('class', cls);
  node.setAttribute('aria-hidden', 'true');
  return {
    node,
    set(lines) {
      node.replaceChildren(...lines.flatMap(({ kind, points }) => ['edge', 'core'].map((part) => {
        const p = document.createElementNS(SVG, 'polyline');
        p.setAttribute('class', `${part} ${kind}`);
        p.setAttribute('points', points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
        return p;
      })));
    },
  };
}

/** A list that could not be fetched: what went wrong, and a way to try again. */
export function faultPage(title: string, err: unknown, again: () => void): HTMLElement {
  // A thrown TypeError is fetch's network failure; anything else is a message we wrote.
  const offline = !(err instanceof Error) || err instanceof TypeError;
  const reason = offline ? 'The request did not reach the server. Check your connection, then try again.' : `${err.message} Try again in a moment.`;
  const retry = el('button', { class: 'button', type: 'button' }, icon('retry'), 'Try again');
  retry.addEventListener('click', again);
  return el('div', { class: 'fault-page', role: 'alert' }, el('h1', { class: 'fault-title' }, title), el('p', {}, reason), retry);
}
