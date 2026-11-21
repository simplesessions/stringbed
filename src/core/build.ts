import type * as THREE from 'three';
import { buildFrame } from './frame';
import { buildButtCap, buildCollar, buildGrip } from './handle';
import { computeLayout } from './layout';
import { applyPaint } from './paint';
import { HOOP_RADIAL } from './section';
import type { Finish, HexColor, RacquetSpec } from './spec';
import { buildCrosses, buildMains } from './strings';
import { buildBumper, buildDampener, buildGrommets } from './trim';

export type PartName = 'frame' | 'bumper' | 'grommets' | 'strings_mains' | 'strings_crosses' | 'grip' | 'collar' | 'butt_cap' | 'dampener';
export interface Part {
  name: PartName;
  geometry: THREE.BufferGeometry; // position, normal; frame also has color
  surface: { color: HexColor; finish: Finish; vertexColors: boolean };
}
export interface RacquetModel {
  spec: RacquetSpec;
  parts: Part[];
}

const WHITE: HexColor = '#ffffff';

/** Models carry no textures: drop any uv attribute a builder may have left. */
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

export function buildRacquet(spec: RacquetSpec): RacquetModel {
  const layout = computeLayout(spec, HOOP_RADIAL[spec.geometry.beam.profile]);
  const p = spec.parts;
  const solid = (name: PartName, geometry: THREE.BufferGeometry, color: HexColor, finish: Finish): Part => ({
    name,
    geometry: clean(geometry),
    surface: { color, finish, vertexColors: false },
  });

  const frame = buildFrame(spec, layout);
  applyPaint(frame, spec.paint);

  // The grommets geometry has a `color` attribute when the spec has o-ports or the part follows
  // the frame paint. That attribute already holds the final colour, so the surface colour is white
  // (a style multiplying base colour by vertex colour then gets the right result). Without it, the
  // part colour comes from the surface.
  const grommets = clean(buildGrommets(spec, layout));
  const grommetVertexColors = grommets.getAttribute('color') !== undefined;
  const bumper = clean(buildBumper(spec, layout));
  const bumperVertexColors = bumper.getAttribute('color') !== undefined;

  const parts: Part[] = [
    { name: 'frame', geometry: clean(frame), surface: { color: WHITE, finish: spec.paint.finish, vertexColors: true } },
    {
      name: 'bumper',
      geometry: bumper,
      surface: { color: bumperVertexColors ? WHITE : p.bumper.color, finish: 'satin', vertexColors: bumperVertexColors },
    },
    {
      name: 'grommets',
      geometry: grommets,
      surface: { color: grommetVertexColors ? WHITE : p.grommets.color, finish: 'satin', vertexColors: grommetVertexColors },
    },
    solid('strings_mains', buildMains(spec, layout), p.strings.color, 'satin'),
    solid('strings_crosses', buildCrosses(spec, layout), p.strings.color, 'satin'),
    solid('grip', buildGrip(spec, layout), p.grip.color, 'matte'),
    solid('collar', buildCollar(spec, layout), p.collar.color, 'satin'),
    solid('butt_cap', buildButtCap(spec, layout), p.buttCap.color, 'satin'),
  ];
  const damp = buildDampener(spec, layout);
  if (damp && p.dampener) parts.push(solid('dampener', damp, p.dampener.color, 'satin'));
  return { spec, parts };
}

export function triangleCount(model: RacquetModel): number {
  let n = 0;
  for (const { geometry: g } of model.parts) n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  return Math.round(n);
}
