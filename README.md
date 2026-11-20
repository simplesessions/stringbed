# stringbed

A library of tennis racquet assets for web and app projects.

Each racquet is a small data file. A generator turns it into a lightweight 3D model that
keeps what makes the frame recognisable: head shape, beam, throat, string pattern and
colourway.

**Gallery:** https://simplesessions.github.io/stringbed/

## What's in v1

- 14 racquets from Babolat, Prince, Solinco, Wilson and Yonex (three each, except Solinco
  with two; see the [roster](docs/racquet-roster.md) for why)
- One binary glTF (`.glb`) per racquet, under 150 KB each, with no textures
- A static gallery to browse, turn and download every model

## Using an asset

Every file is served from the gallery site:

```
https://simplesessions.github.io/stringbed/realistic/<racquet id>.glb
https://simplesessions.github.io/stringbed/catalog.json
```

`catalog.json` lists every racquet with its specs, a base colour swatch, its part names and
the path, size and triangle count of each file. Read paths from it rather than building them.

**Coordinates:** metres, Y up, butt cap at the origin, the racquet runs up +Y, the string
bed lies in the XY plane and +Z is the hitting-face normal. A 27 in racquet is 0.6858 tall.

**Parts:** every model has one node per part, each with its own material named
`mat_<part>`. These names will not change:

`frame`, `bumper`, `grommets`, `strings_mains`, `strings_crosses`, `grip`, `collar`,
`butt_cap`, and `dampener` (only when a racquet has one; none do in v1).

The frame's paint is stored as vertex colours. Recolour any other part at runtime by name:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().loadAsync(
  'https://simplesessions.github.io/stringbed/realistic/wilson-blade-98-v10.glb');
gltf.scene.getObjectByName('grip').material.color.set('#f4f1ea');
scene.add(gltf.scene);
```

## Adding a racquet

1. Add a JSON spec at `racquets/<brand>/<id>.json` (copy a similar one; the schema is in
   `src/core/spec.ts`).
2. Run `npm run generate`.
3. Commit the spec and the regenerated `assets/`.

Never edit files in `assets/` by hand. CI fails if they don't match the specs.

## Development

```
npm install
npm test               # unit tests
npm run typecheck
npm run generate       # specs -> assets/ (add -- --check to verify only)
npm run dev            # gallery at http://localhost:5173/stringbed/
npm run build          # static site in dist/
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

## Trademarks

Racquet and brand names are trademarks of their owners and are used here only to identify
the models. This project is not affiliated with or endorsed by any manufacturer. Assets
contain no logos or wordmarks.
