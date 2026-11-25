// A string cut through, drawn at one true scale: every section, of any string or gauge, can be held
// against every other, and a bar under it says how long a millimetre is.
import type { StringSpec } from '../../src/string-spec';
import { sectionNote } from './string-view';

/** The one scale: CSS px to a millimetre. */
export const PX_PER_MM = 100;

const WIDTH = 160; // room for the thickest gauge the data allows (1.45 mm)
const HEIGHT = 192;
const CENTRE = 78;
const BAR_Y = 170;

/** Corners of a shaped section about its centre, on a circle as wide as the gauge, standing on a flat face. None when round. */
export function sectionCorners(sides: number, gaugeMm: number): Array<[number, number]> {
  const r = (gaugeMm / 2) * PX_PER_MM;
  return Array.from({ length: sides }, (_, i) => {
    const a = Math.PI / 2 + (Math.PI * (2 * i + 1)) / sides;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

const SVG = 'http://www.w3.org/2000/svg';
function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text = ''): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  n.textContent = text;
  return n;
}

/** In the string's colour (`--swatch`). An unknown shape is a dashed ring: its width is known, its outline is not. */
export function crossSection(shape: StringSpec['shape'], gaugeMm: number): SVGSVGElement {
  const x = WIDTH / 2;
  const svg = node('svg', { class: 'section-drawing', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, width: WIDTH, height: HEIGHT, role: 'img', 'aria-label': `Cross-section: ${sectionNote(shape)}, ${gaugeMm.toFixed(2)} mm` });
  const outline = shape?.sides
    ? node('polygon', { points: sectionCorners(shape.sides, gaugeMm).map(([dx, dy]) => `${(x + dx).toFixed(2)},${(CENTRE + dy).toFixed(2)}`).join(' ') })
    : node('circle', { cx: x, cy: CENTRE, r: (gaugeMm / 2) * PX_PER_MM });
  outline.setAttribute('class', shape ? 'section-cut' : 'section-cut is-unknown');
  const left = x - PX_PER_MM / 2;
  svg.append(
    outline,
    node('path', { class: 'section-bar', d: `M${left} ${BAR_Y - 4}v8M${left} ${BAR_Y}h${PX_PER_MM}M${left + PX_PER_MM} ${BAR_Y - 4}v8` }),
    node('text', { class: 'section-unit', x, y: BAR_Y + 18, 'text-anchor': 'middle' }, '1 mm'),
  );
  return svg;
}
