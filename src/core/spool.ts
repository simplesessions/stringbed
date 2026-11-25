import type { BufferGeometry } from 'three';
import type { Part } from './build';
import { RawMesh } from './raw';

export type SpoolPartName = 'spool' | 'spool_string';
export interface SpoolPart { name: SpoolPartName; geometry: BufferGeometry; surface: Part['surface'] }

const SEGMENTS = 40; // a multiple of four, so the widest vertices land exactly on the x and z axes
const HEIGHT = 0.07;
const FLANGE_R = 0.055; // 0.11 m across
const FLANGE_T = 0.005;
const CORE_R = 0.03;
const TURNS = 12; // few and fat, so they still read as turns in a small thumbnail and in the Pixel look
const PITCH = (HEIGHT - 2 * FLANGE_T - 0.002) / TURNS; // winding fills the core, a hair short of each flange
const VALLEY_R = 0.0403; // where one turn meets the next
const CREST_R = 0.0425;

type Profile = Array<[radius: number, y: number]>;

/**
 * Revolve (radius, y) profiles about the y axis. They run bottom to top, so faces point outward.
 * Shading is smooth along a profile and hard from one to the next: they share no vertices.
 */
function revolve(profiles: Profile[]): BufferGeometry {
  const m = new RawMesh();
  for (const profile of profiles) {
    // One vertex where the profile meets the axis, a ring of them elsewhere.
    const rows = profile.map(([r, y]) => Array.from({ length: r === 0 ? 1 : SEGMENTS }, (_, i) => {
      const a = (2 * Math.PI * i) / SEGMENTS;
      return m.vertex(r * Math.cos(a), y, -r * Math.sin(a));
    }));
    for (let j = 0; j + 1 < rows.length; j++) {
      const lo = rows[j], hi = rows[j + 1];
      for (let i = 0; i < SEGMENTS; i++) {
        const i2 = (i + 1) % SEGMENTS;
        if (lo.length > 1) m.tri(lo[i], lo[i2], hi[i % hi.length]);
        if (hi.length > 1) m.tri(lo[i2 % lo.length], hi[i2], hi[i]);
      }
    }
  }
  return m.build();
}

/**
 * A string spool standing on its flange at the origin. The flanges and core are one part, the
 * winding another, so a viewer can tint the winding to a string's colour. Symmetric, no uv, no text.
 */
export function buildSpool(): SpoolPart[] {
  const top = HEIGHT - FLANGE_T;
  // One profile per face: every corner of a moulded reel is a hard one.
  const outline: Profile = [[0, 0], [FLANGE_R, 0], [FLANGE_R, FLANGE_T], [CORE_R, FLANGE_T], [CORE_R, top], [FLANGE_R, top], [FLANGE_R, HEIGHT], [0, HEIGHT]];
  const body = revolve(outline.slice(1).map((to, i) => [outline[i], to]));

  // Wound string: one profile per turn, so each is shaded round like a cord and creased against the
  // next. They alternate slightly in radius, as a hank does.
  const y0 = FLANGE_T + 0.001;
  const turns = Array.from({ length: TURNS }, (_, t): Profile => {
    const y = y0 + t * PITCH;
    const crest = CREST_R + (t % 2 === 0 ? 0.0003 : -0.0003);
    return [[VALLEY_R, y], [crest, y + PITCH * 0.3], [crest, y + PITCH * 0.7], [VALLEY_R, y + PITCH]];
  });
  const y1 = y0 + TURNS * PITCH;
  const wound = revolve([[[CORE_R, y0], [VALLEY_R, y0]], ...turns, [[VALLEY_R, y1], [CORE_R, y1]]]);

  return [
    { name: 'spool', geometry: body, surface: { color: '#26272a', finish: 'satin', vertexColors: false } },
    { name: 'spool_string', geometry: wound, surface: { color: '#f2f2f2', finish: 'satin', vertexColors: false } },
  ];
}
