# stringbed

A library of tennis racquet assets for web and app projects.

Each racquet is a small data file. A generator turns it into a lightweight 3D model that
keeps what makes the frame recognisable: head shape, beam, throat, string pattern and
colourway.

**Gallery:** https://simplesessions.github.io/stringbed/

## What's in the library

- 358 modelled racquets from Babolat, Dunlop, Head, Prince, Solinco, Tecnifibre, Wilson and Yonex, as 87 frames
  (one per generation of a line) with their sizes as variants, plus official colourways
- One binary glTF (`.glb`) per racquet and colourway, about 35 KB each, meshopt-compressed, with no textures
- Researched racquets without a model yet (`placeholders/`), listed in the gallery
- A static gallery to browse, turn and download every model, in Realistic, Pixel or Line looks

## Using an asset

Every file is served from the gallery site:

```
https://simplesessions.github.io/stringbed/realistic/<racquet id>.glb
https://simplesessions.github.io/stringbed/catalog.json
```

`catalog.json` lists every racquet with its specs, a base colour swatch, its part names and
the path, size and triangle count of each file. Read paths from it rather than building them.
Each racquet page in the gallery also shows its file URL and a loader snippet to copy.

**Meshopt:** the files use `EXT_meshopt_compression` and `KHR_mesh_quantization`, so the loader
needs a meshopt decoder (`setMeshoptDecoder` in three.js, as above; most other engines and
viewers support it, or run `gltf-transform copy in.glb out.glb` to get a plain file).

### Importing exactly the racquet you want

`catalog.json` has a flat `files` list: one row per downloadable file, with `id`, `brand`,
`line`, `lineage` (every generation of a line), `model`, `generation`, `year`, `variant` (the
size within its frame, e.g. "98", "MP", "Junior 26"), `colourway`, `path` and `bytes`.
Filter it, then load the path:

```js
const base = 'https://simplesessions.github.io/stringbed/';
const { files } = await (await fetch(base + 'catalog.json')).json();

// The newest Pure Aero 98 in its standard colourway:
const pick = files
  .filter((f) => f.lineage === 'babolat-pure-aero' && f.variant === '98' && !f.colourway)
  .sort((a, b) => b.year - a.year)[0];

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync(base + pick.path);
```

File names follow the racquet id, so a link you already use keeps working:
`realistic/<racquet id>.glb`, and `realistic/<racquet id>--<colourway id>.glb` for other
colourways (e.g. `yonex-ezone-100--espresso-brown.glb`).

**Coordinates:** metres, Y up, butt cap at the origin, the racquet runs up +Y, the string
bed lies in the XY plane and +Z is the hitting-face normal. A 27 in racquet is 0.6858 tall.

**Parts:** every model has one node per part, each with its own material named
`mat_<part>`. These names will not change:

`frame`, `bumper`, `grommets`, `strings_mains`, `strings_crosses`, `grip`, `collar`,
`butt_cap`, and `dampener` (only when a racquet has one; none do in v1).

The frame's paint is stored as vertex colours. Recolour any other part at runtime by name:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync(
  'https://simplesessions.github.io/stringbed/realistic/wilson-blade-98-v10.glb');
gltf.scene.getObjectByName('grip').material.color.set('#f4f1ea');
scene.add(gltf.scene);
```

## Using it as a library

Releases are git tags (`v1.0.0`, …) with the built package tarball attached; see `CHANGELOG.md`.
Pin a version from another project (a bare `github:` install does not work: the built `lib/` is only in the tarball):

```sh
bun add https://github.com/simplesessions/stringbed/releases/download/v1.0.0/stringbed-1.0.0.tgz three
```

```ts
import { buildRacquet, parseSpec, modelToGlb, styles } from 'stringbed';
import catalog from 'stringbed/catalog.json';
import spec from 'stringbed/racquets/babolat/babolat-pure-aero-100.json';

const model = buildRacquet(parseSpec(spec, 'pure-aero'));   // three.js geometry per named part
// Ready-made files: stringbed/assets/<path from catalog.json>
```

`three` is a peer dependency. The package is about 5 MB packed, almost all of it GLB files.

## Adding a racquet

1. Add a JSON spec at `racquets/<brand>/<id>.json` (copy a similar one; the schema is in
   `src/core/spec.ts`).
2. Run `bun run generate`.
3. Commit the spec and the regenerated `assets/`.

Never edit files in `assets/` by hand. CI fails if they don't match the specs.

## Development

```
bun install
bun test               # unit tests
bun run typecheck
bun run generate       # specs -> assets/ (add --check to verify only)
bun run dev            # gallery at http://localhost:5173/stringbed/
bun run build          # static site in dist/
```

## Later

Customization (grips, strings, dampeners) and other visual styles (toon, pixel, voxel and
more). See the [roadmap](docs/roadmap.md).

## Docs

| Doc | What it is |
|---|---|
| [Design](docs/superpowers/specs/2026-11-19-stringbed-design.md) | What this is, why, and how it is structured |
| [Racquet roster](docs/racquet-roster.md) | The racquets, their sources, and what gives each its identity |
| [Implementation plan](docs/superpowers/plans/2026-11-19-stringbed-v1.md) | Task-by-task build plan for v1 |
| [Roadmap](docs/roadmap.md) | Customization, visual styles and what comes after |

## Licence

MIT, see `LICENSE`.

## Trademarks

Racquet and brand names are trademarks of their owners and are used here only to identify
the models. This project is not affiliated with or endorsed by any manufacturer. Assets
contain no logos or wordmarks.
