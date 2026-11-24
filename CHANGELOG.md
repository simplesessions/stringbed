# Changelog

Versions follow semver. The public contract is: part names and the coordinate convention in the
design doc, the spec JSON shape, `catalog.json` (its own `version` field is the schema version),
and the exports of the package entry. A change to any of those that breaks a consumer is a major
bump; new racquets, new colourways and fixes to existing models are minor or patch.

## Unreleased

- Spec: optional `geometry.handle.elongationMm` (pallet width minus depth). Handles of every brand
  but Solinco are now wider in the string plane than deep; part names and girth are unchanged.
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
