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
export { stringSpecSchema, parseString, loadAllStrings, STRING_RATINGS, STRING_TAGS } from './string-spec';
export type { StringSpec, StringMaterial } from './string-spec';
export { buildSpool } from './core/spool';
export type { SpoolPart, SpoolPartName } from './core/spool';
export { modelToGlb } from './export/glb';
export { styles } from './styles';
export type { Style } from './styles';
export { bedLines, restring, strandGeometry } from './restring';
export type { Bed, Beds, Line, Strand } from './restring';
export { placeTape, tapeAt, tapeGeometry } from './tape';
export type { PlacedTape, TapePiece, TapeZone } from './tape';
export { baseline, dampenerMass, DAMPENER_G, DENSITY, OVERGRIP_G, overgripMass, pitchHz, PUBLISHED_BED, readout, REFERENCE_BED, stringMasses, TAPE_G_PER_INCH, tapeMasses, WRAP_M } from './mass';
export type { Baseline, PointMass, Readout, Strung } from './mass';
export type { Catalog, StringCatalog } from './catalog';
