import type { Finish } from '../core/spec';
import { hexToLinear } from '../core/color';
import { modelToGlb } from '../export/glb';
import type { Style } from './types';

const ROUGHNESS: Record<Finish, number> = { matte: 0.85, satin: 0.55, gloss: 0.25 };

export const realistic: Style = {
  id: 'realistic',
  kind: '3d',
  extension: 'glb',
  label: 'Realistic',
  render: (model) =>
    modelToGlb(model, (part) => ({
      baseColor: hexToLinear(part.surface.color),
      metallic: 0,
      roughness: ROUGHNESS[part.surface.finish],
    })),
};
