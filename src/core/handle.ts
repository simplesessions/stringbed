import * as THREE from 'three';
import type { Layout } from './layout';
import { RawMesh } from './raw';
import type { RacquetSpec } from './spec';

// Handle dimensions in metres. All octagons have flats facing +-X and +-Z (so the bounding box
// half-width equals the apothem). A real 4 3/8" grip is about 0.111 m round, ~0.035 m across flats.
const BUTT_CAP_HEIGHT = 0.02;
/** Butt cap rings (y, apothem): flares out above the bottom face, then settles under the grip. */
const BUTT_CAP_RINGS: [number, number][] = [[0, 0.017], [0.004, 0.0198], [BUTT_CAP_HEIGHT, 0.0186]];
const GRIP_APOTHEM_BOTTOM = 0.0178;
const GRIP_APOTHEM_TOP = 0.0170;
/** Collar: a band straddling gripTopY, then a shoulder that narrows to just wider than the shaft. */
const COLLAR_BELOW = 0.004;
const COLLAR_ABOVE = 0.008;
const COLLAR_SHOULDER_Y = 0.002;
const COLLAR_APOTHEM = 0.0184;
const COLLAR_APOTHEM_TOP = 0.0155;
const SIDES = 8;

/**
 * Octagonal prism through `rings` (y, apothem), hard edges (every face has its own vertices).
 * Caps are optional and flat. Triangle count: 16 per ring gap plus 6 per cap.
 */
function octagon(rings: [number, number][], capBottom: boolean, capTop: boolean): THREE.BufferGeometry {
  const m = new RawMesh();
  const corner = (k: number, y: number, a: number): [number, number, number] => {
    const phi = ((k - 0.5) * 2 * Math.PI) / SIDES;
    const R = a / Math.cos(Math.PI / SIDES);
    return [R * Math.cos(phi), y, R * Math.sin(phi)];
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    for (let k = 0; k < SIDES; k++) {
      const b0 = m.vertex(...corner(k, rings[r][0], rings[r][1]));
      const b1 = m.vertex(...corner(k + 1, rings[r][0], rings[r][1]));
      const t0 = m.vertex(...corner(k, rings[r + 1][0], rings[r + 1][1]));
      const t1 = m.vertex(...corner(k + 1, rings[r + 1][0], rings[r + 1][1]));
      m.tri(b0, t0, t1);
      m.tri(b0, t1, b1);
    }
  }
  const cap = (ring: [number, number], up: boolean) => {
    const c = m.vertex(0, ring[0], 0);
    const vs = Array.from({ length: SIDES }, (_, k) => m.vertex(...corner(k, ring[0], ring[1])));
    for (let k = 0; k < SIDES; k++) {
      if (up) m.tri(c, vs[(k + 1) % SIDES], vs[k]);
      else m.tri(c, vs[k], vs[(k + 1) % SIDES]);
    }
  };
  // Corner order runs from +X toward +Z, which is clockwise seen from +Y; so up-facing caps reverse it.
  if (capBottom) cap(rings[0], false);
  if (capTop) cap(rings[rings.length - 1], true);
  return m.build();
}

/** Grip: from the butt cap top to gripTopY, slight taper (wider toward the butt). */
export function buildGrip(_spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  return octagon([[BUTT_CAP_HEIGHT, GRIP_APOTHEM_BOTTOM], [layout.gripTopY, GRIP_APOTHEM_TOP]], false, false);
}

/** Collar: closed octagonal band that hides the seam between grip and shaft. */
export function buildCollar(_spec: RacquetSpec, layout: Layout): THREE.BufferGeometry {
  const y = layout.gripTopY;
  return octagon(
    [[y - COLLAR_BELOW, COLLAR_APOTHEM], [y + COLLAR_SHOULDER_Y, COLLAR_APOTHEM], [y + COLLAR_ABOVE, COLLAR_APOTHEM_TOP]],
    false,
    true,
  );
}

/** Butt cap: flared octagon from y = 0 to 0.02, closed top and bottom. */
export function buildButtCap(_spec: RacquetSpec, _layout: Layout): THREE.BufferGeometry {
  return octagon(BUTT_CAP_RINGS, true, true);
}
