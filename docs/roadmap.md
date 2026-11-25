# Roadmap

What comes after v1, and what v1 does to keep the door open. Nothing here is designed in
detail; each item gets its own design when it is picked up.

## 1. Customization

**Built:** the Build page (`#/build/<racquet>`) puts strings (hybrids too), tension, lead tape,
overgrip and a dampener on any racquet in the browser, with a weight, balance and swingweight
estimate and how it plays. 73 strings from 14 brands are in `strings.json`. Racquet downloads stay stock.

**Still planned:**

- A download of the restrung, taped racquet.
- Leather grips, butt-cap lead (trap door colours) and string weave.
- Build presets.
- The remaining string brands, Diadem and Ashaway.

**Original want:** take any racquet and change its grip, strings, dampener and similar, then get
an asset (or a live view) of the result.

**Seam left in v1:**

- Every spec has a `parts` block holding the defaults for grip, butt cap, strings, grommets,
  bumper and dampener. A customization is an override of that block and nothing else.
- Every part is its own named node with its own material in the exported file
  (`grip`, `strings_mains`, `strings_crosses`, `butt_cap`, `collar`, `grommets`, `bumper`,
  `dampener`). Simple recolours can happen at runtime in any glTF viewer, with no
  regeneration.
- `buildRacquet` runs in both Node and the browser, so a future customizer can rebuild
  geometry live (overgrip thickness, string gauge, a dampener) instead of only recolouring.

**Done from the first steps:** overgrip, string colour, hybrid strings, dampener, lead tape.
**Left:** grip colour on the model itself, dampener shapes and the planned items above.

## 2. Visual styles

**Want:** the same racquets in different looks. Some 3D, some not. Ideas so far: toon-shaded,
pixel art, voxel. Others will come.

**Seam left in v1:**

- The spec describes the racquet, not how it is drawn. `src/core` produces a style-neutral
  model; `src/styles/<id>` turns it into a file. `realistic` is simply the first style.
- A style declares whether it is `3d` or `2d` and what file extension it writes. Output is
  namespaced: `assets/<style>/<racquet>.<ext>`.
- `assets/catalog.json` lists the styles available per racquet, and the gallery reads that
  rather than assuming `.glb`.

**How each idea would plug in:**

| Style | Kind | Sketch |
|---|---|---|
| Toon | 3D | Same geometry, flat-banded shading and an outline. May need no new files, only a viewer material |
| Voxel | 3D | Voxelize the model at a fixed grid; keep part names as groups so customization still works |
| Pixel | 2D | Project outline and paint zones to a small sprite at fixed angles |
| Flat / line icon | 2D | SVG from the head outline, throat and paint zones |

A style switcher in the gallery arrives with the second style.

## 3. Library growth

- More brands: Völkl, ProKennex (Head, Tecnifibre and Dunlop are in).
- More models per brand, and variants (weights, 18×20 versions, extended lengths).
- Previous generations and classic frames.
- Possibly pickleball and padel, which would test how racquet-specific the spec really is.

## 4. Distribution

- npm package exporting the catalog, the specs and `buildRacquet`.
- Versioned releases, so consuming projects can pin.
- Pre-rendered thumbnails for places that cannot run WebGL.
- Draco or Meshopt compression if file sizes start to matter.
