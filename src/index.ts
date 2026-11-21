// Public entry of the `stringbed` package. Browser-safe: no node imports at module load.
// Node-only helpers (`loadAllSpecs`, `loadPlaceholders`) read the repo's folders, so they only
// make sense when you have the `racquets/` directory, e.g. inside this repo or a checkout.
export { buildRacquet, triangleCount } from './core/build';
export type { Part, PartName, RacquetModel } from './core/build';
export { lineageOf, parseSpec, racquetSpecSchema, withColourway, withVariant } from './core/spec';
export type { Colourway, RacquetSpec, Variant } from './core/spec';
export { loadAllSpecs } from './core/spec';
export { placeholderSchema, loadPlaceholders } from './placeholders';
export type { Placeholder } from './placeholders';
export { modelToGlb } from './export/glb';
export { styles } from './styles';
export type { Style } from './styles';
export type { Catalog } from './catalog';
