# Changelog

Versions follow semver. The public contract is: part names and the coordinate convention in the
design doc (including the spool's `spool` and `spool_string`), the spec JSON shape, `catalog.json`
and `strings.json` (each with its own `version` field as the schema version), and the exports of the package entry. A change to any of those that breaks a consumer is a major
bump; new racquets, new colourways and fixes to existing models are minor or patch.

## Unreleased

- Fix: in the Line look, dark parts (black strings, spool flanges, black grips) draw their inner lines pale, so they no longer merge.
- Strings: 73 strings from 14 brands in `strings/`, written to `assets/strings.json` (version 1) with
  a `spool` entry, and a string spool model, `assets/models/string-spool.glb`, with parts `spool`
  and `spool_string`. New contract files: `strings.json` and the spool's part names.
- Gallery: a Strings room (`#/strings`, by brand) with a page and a spool for each string, and
  strings in the ⌘K search.
- Spec: optional `balanceMm`, `strungWeightG`, `strungBalanceMm`, `swingweight` and `stiffnessRa`
  under `specs`, for numbers published by the maker or a retailer. Filled so far from the makers'
  own pages: weight and balance for 10 racquets (Babolat, Dunlop), stiffness for 6 (Babolat).
- Package: new exports, all browser-safe except `loadAllStrings` (it reads the `strings/` folder):
  - strings: `stringSpecSchema`, `parseString`, `loadAllStrings`, `STRING_RATINGS`, `STRING_TAGS`,
    and types `StringSpec`, `StringMaterial`, `StringCatalog`;
  - spool: `buildSpool`, and types `SpoolPart`, `SpoolPartName`;
  - string bed: `bedLines`, `restring`, `strandGeometry`, and types `Bed`, `Beds`, `Line`, `Strand`;
  - lead tape: `placeTape`, `tapeAt`, `tapeGeometry`, and types `PlacedTape`, `TapePiece`, `TapeZone`;
  - mass: `stringMasses`, `tapeMasses`, `overgripMass`, `dampenerMass`, `baseline`, `readout`,
    `pitchHz`, constants `DENSITY`, `WRAP_M`, `TAPE_G_PER_INCH`, `OVERGRIP_G`, `DAMPENER_G`,
    `PUBLISHED_BED`, `REFERENCE_BED`, and types `Strung`, `PointMass`, `Baseline`, `Readout`;
  - subpaths `stringbed/strings.json` and `stringbed/strings/*`.
- Build page: `#/build/<racquet>` shows a racquet with chosen strings, tension, lead tape, overgrip
  and dampener, with an estimate of weight, balance, swingweight and how it plays. The address
  format is stable from `v=1`. The download stays the stock model.
- Fix: dark strings stay dark in the Pixel look.
- Spec: optional `geometry.handle.elongationMm` (pallet width minus depth). Handles of every brand
  but Solinco are now wider in the string plane than deep; part names and girth are unchanged.
- Spec: optional `side` (paint that differs left and right) and `bridge: false` on paint zones.
- Colourways of every brand corrected against product photos.
- Fix: grommet strips with a `channel` on box and tapered-box beams faced inward and did not show.
- Dunlop and Tecnifibre added.

## 1.0.0

First tagged release.

- GLBs are meshopt-compressed (`EXT_meshopt_compression` + `KHR_mesh_quantization`), about
  3.5x smaller: readers need a meshopt decoder.
- 300 racquets across the brands in `docs/racquet-roster.md`, generated as GLB in the realistic
  style, plus research-only placeholders.
- Package entry `stringbed`: `buildRacquet`, `parseSpec`, `modelToGlb`, `styles`, and the spec
  and catalog types. `three` is a peer dependency.
- Data files: `stringbed/catalog.json`, `stringbed/assets/*`, `stringbed/racquets/*`.
