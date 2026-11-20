import { headOutline } from './outline';
import type { RacquetSpec } from './spec';
import { inToM } from './units';

export interface Layout {
  totalLength: number; // metres
  gripTopY: number; // top of the grip; u = 0
  bridgeY: number; // lowest point of the inner hoop
  headCenterY: number; // centre of the outline
  tipY: number; // outer tip of the frame; equals totalLength
}

const STANDARD_LENGTH_IN = 27;
const STANDARD_GRIP_M = 0.178;

/**
 * Vertical layout along the racquet axis (butt cap at y = 0). Head size comes from the outline
 * only. Length beyond 27 in is shared equally between grip and throat, never the head.
 * `hoopRadial` is the in-plane beam extent of the hoop, supplied by the frame builder.
 */
export function computeLayout(spec: RacquetSpec, hoopRadial: number): Layout {
  const { headSizeSqIn, lengthIn } = spec.specs;
  const { shape, aspect } = spec.geometry.head;
  const totalLength = inToM(lengthIn);
  const extra = totalLength - inToM(STANDARD_LENGTH_IN);

  const loop = headOutline(shape, headSizeSqIn, aspect, 256);
  const innerHalfLength = Math.max(...loop.map((p) => p.y));

  const tipY = totalLength;
  const headCenterY = tipY - hoopRadial - innerHalfLength;
  return {
    totalLength,
    gripTopY: STANDARD_GRIP_M + extra / 2,
    bridgeY: headCenterY - innerHalfLength,
    headCenterY,
    tipY,
  };
}
