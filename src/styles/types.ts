import type { RacquetModel } from '../core/build';

export interface Style {
  id: string;
  kind: '3d' | '2d';
  extension: string;
  label: string;
  render(model: RacquetModel): Promise<Uint8Array>;
}
