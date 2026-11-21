# stringbed — design

Status: approved in conversation on 2026-11-19. Nothing is built yet.
Companion docs: [racquet roster](../../racquet-roster.md), [roadmap](../../roadmap.md),
[implementation plan](../plans/2026-11-19-stringbed-v1.md).

## Intent

A public library of tennis racquet assets the owner can drop into web apps, native apps and
other projects. The first deliverable is a set of lightweight 3D models plus a GitHub Pages
gallery for browsing them.

The racquets are icons, not replicas. A viewer who knows racquets should be able to tell a
Pure Aero from a Blade from a Percept at thumbnail size, from the things that actually give
each frame its identity: head shape, beam thickness and cross-section, throat geometry,
string pattern, and colourway.

## Goals

1. 15 racquets: three current, popular models from each of Yonex, Babolat, Wilson, Solinco
   and Prince (see the roster).
2. Each racquet is a small data file. One generator turns every data file into a `.glb`.
3. Assets are light enough for a web page to show many at once.
4. A static gallery, deployed to GitHub Pages, that shows every asset, lets you inspect one
   in 3D, and lets you download it.
5. Structure that leaves room for two planned extensions without a rewrite:
   - **Customization**: swapping grip, strings, dampener and so on.
   - **Visual styles**: toon-shaded, pixel, voxel and others, some of them not 3D.

## Non-goals (v1)

- No customization UI and no alternative styles. Only the seams for them.
- No npm package, CDN publishing or versioned releases.
- No thumbnails, sprites or 2D exports.
- No animation, physics or playing characteristics.
- No weight, balance or swingweight modelling beyond storing the published numbers.

## Anti-goals

- **Brand logos, wordmarks and string stencils.** The repo is public. Shapes and colourways
  are reproduced; trademarks are not. Model names are used only as labels.
- **Hand-edited meshes.** If a `.glb` cannot be regenerated from its data file, the
  customization and style plans both break.
- **Intricate detail.** Individual grommet holes, real string weave, paint text and decals
  are out. If a detail is invisible at 256 px it does not belong in v1.
- **Generic racquets in different colours.** If two frames with different geometry come out
  with the same silhouette, the library has failed at its one job.

## Constraints

- Public GitHub repo `simplesessions/stringbed`, default branch `main`.
- Gallery must work as a static site on GitHub Pages under the `/stringbed/` base path.
- The gallery is designed with the Impeccable skill (installed at
  `.claude/skills/impeccable`).
- Per-racquet budget: at most 15,000 triangles and 150 KB per `.glb`. No textures in v1.
- Generation is deterministic: the same data file always produces a byte-identical `.glb`.

## Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **Parametric generator** — data file per racquet, code builds the mesh | Less sculptural nuance; every racquet shares one geometric vocabulary. In return, restyling and part swapping are data changes, and adding racquet 16 is a JSON file. | **Chosen** |
| Hand-modelled meshes (Blender) exported to glTF | Best-looking single asset. Cannot be restyled, cannot be re-parted without a modeller, and an agent cannot author them reliably. | Rejected: works against both planned extensions |
| Image-to-3D / generative meshes | Fast, but uncontrolled topology, baked logos, no named parts, inconsistent scale between racquets. | Rejected: breaks the no-logo rule and the named-parts requirement |

## Architecture

Three layers. Each one only knows about the layer above it.

```
racquets/<brand>/<id>.json      1. SPEC    what the racquet is (data)
        │
        ▼
src/core  buildRacquet(spec)    2. MODEL   style-neutral named parts with geometry
        │
        ▼
src/styles/<style>              3. STYLE   turns a model into an output file
        │
        ▼
assets/<style>/<id>.<ext>  +  assets/catalog.json
        │
        ▼
site/                           gallery reads catalog.json and loads the files
```

### 1. Spec

One JSON file per racquet. It is the source of truth for everything downstream. Four groups
of fields:

- **Identity**: `id`, `brand`, `line`, `model`, `generation`, `year`.
- **Published specs**: head size, length, string pattern, beam widths, unstrung weight.
  These are facts from the manufacturer and drive real dimensions.
- **Geometry character**: the choices that numbers do not capture — head shape family, beam
  cross-section family, throat style, special features such as Prince O-Ports.
- **Paint**: base colour and finish, colour zones along the frame, and an optional
  procedural pattern (Solinco's camo).
- **Parts**: default grip, butt cap, strings, grommets, bumper, dampener. This block is the
  customization seam: a future customizer overrides it and nothing else.

Every spec also records `sources` (URLs) and a `verified` flag saying whether its colourway
and dimensions were checked against current manufacturer material.

### 2. Model

`buildRacquet(spec)` returns a list of named parts. Each part has a fixed name, a geometry,
and a neutral surface description (colour and finish, not a three.js material).

Fixed part names, which are also the node names in the exported file:

`frame`, `bumper`, `grommets`, `strings_mains`, `strings_crosses`, `grip`, `collar`,
`butt_cap`, and `dampener` (reserved; absent unless the spec asks for one).

These names are a public contract. Consumers will look parts up by name to recolour or
replace them, so they must not change once assets are published.

Coordinate convention, also a public contract: metres, Y up, butt cap at the origin, the
racquet extends along +Y, the string bed lies in the XY plane, and +Z is the hitting-face
normal. A 27 in racquet is 0.6858 units tall.

### 3. Style

A style takes a model and writes one output file. v1 ships exactly one: `realistic`, which
writes a binary glTF with one PBR material per part and frame paint baked as vertex colours.

A style declares an `id`, a `kind` (`3d` or `2d`) and a file extension. Output goes to
`assets/<style id>/<racquet id>.<ext>`. The catalog lists, for each racquet, which styles
exist and where their files are, so the gallery never hardcodes a style.

How this makes room for the future styles:

- **Toon**: same model, different material and an outline pass. Probably a second `.glb`
  or just a viewer-side shader.
- **Voxel**: voxelize the model's geometry; part names survive as voxel groups.
- **Pixel / flat 2D**: project the model's outline and paint zones to SVG or PNG.

None of these is designed here. The requirement on v1 is only that nothing in `src/core`
imports from a style, and nothing in the gallery assumes `.glb`.

### Geometry vocabulary

What the generator must be able to express, because these are the differences between the
15 racquets:

| Trait | Values needed in v1 | Why |
|---|---|---|
| Head shape | `oval`, `isometric`, `teardrop` | Yonex's squared-off isometric head is its whole identity |
| Head size | 97–100 sq in, from the spec | Drives real width and length of the hoop |
| Beam widths | tip / mid / shaft in mm | A 21 mm Blade and a 26 mm Pure Drive look nothing alike side-on |
| Beam cross-section | `box`, `ellipse`, `aero`, `tapered-box` | Box beams read as "player's frame"; the Pure Aero's flattened aero beam is its signature |
| Throat | open V or open U, curved or flat bridge | Changes the silhouette more than anything except the head |
| String pattern | mains × crosses | 18×20 is visibly denser than 16×18 |
| Features | `o-ports`, `aero-fins` | Prince Ripstick and O3 Phantom; Yonex VCORE tip |
| Paint zones | ranges along the frame (shaft to tip) with colours and blends | Colourway is the fastest recognition cue |
| Paint pattern | `camo` | Solinco's tiger camo is the brand's visual signature |

### Gallery

A static single page. Shows a browsable grid of all racquets grouped or filterable by brand,
and a detail view with an orbitable 3D model, the published specs, the list of part names,
and a download link for the file.

Requirements that come from the medium rather than taste:

- At most two WebGL contexts on the page, however many racquets are shown. Browsers cap
  contexts at around 16, and this library will grow past that.
- Loads the generated files from `catalog.json`, not the specs, so the gallery is also a
  test that the published assets work.
- Works without WebGL to the extent of listing the racquets and offering downloads.
- Usable from 375 px wide, keyboard navigable, respects reduced-motion.

Look and feel are deliberately not specified here. That is Impeccable's job: run its
project-context setup first, then design the page with it.

## Decisions already made

| Decision | Choice | Who |
|---|---|---|
| Repo name | `stringbed` | Proposed by Claude, approved by owner |
| Visibility | Public | Owner |
| Lineup | The 15 in the roster | Proposed by Claude, approved by owner |
| Logos | Left out | Proposed by Claude, approved by owner |
| Design skill for the gallery | Impeccable | Owner |
| Parametric generation | Yes | Proposed by Claude, approved by owner |
| TypeScript, three.js, Vite, Vitest, glTF-Transform | See plan | Claude's call |
| Generated files committed to the repo | Yes, with a CI check that regeneration is a no-op | Claude's call |
| Frame paint as vertex colours, no textures | Yes | Claude's call |

## Left to the builder

- Exact curve maths for the three head shapes and four beam cross-sections.
- How the camo pattern is generated, within the no-textures rule.
- How O-Ports are represented. Real holes through the frame are not required; a convincing
  inset is enough.
- Tessellation density, within the triangle budget.
- Keeping paint edges crisp: every zone boundary is built as a geometric seam (two coincident
  rings with u either side), so vertex colours cannot smear a graphic over a ring gap.
- Every visual decision in the gallery.

## Open items for the owner

1. **Licence.** (Resolved: MIT, see `LICENSE`.) The repo had none, which legally means "all rights reserved" even though
   it is public. Pick one (MIT is the usual choice for an asset library you want to reuse
   freely) before promoting it.
2. **Solinco Shadow.** Could not be confirmed as a current model during design research. The
   plan's first roster task verifies it and falls back as described in the roster.
3. **Impeccable install flagged.** The installer reported "1 alert" from Socket and
   "Med Risk" from Snyk for the skill. Details: https://skills.sh/pbakaus/impeccable. Skills
   run with full agent permissions, so skim `.claude/skills/impeccable` before relying on it.
