import { hexToLinear } from '../core/color';
import { modelToGlb } from '../export/glb';
import { ROUGHNESS } from './finish';
import type { Style } from './types';

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
