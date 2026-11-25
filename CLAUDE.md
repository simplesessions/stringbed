# stringbed

Parametric tennis racquet asset library. Public repo: `simplesessions/stringbed`.

Start here, in this order:

1. `docs/superpowers/specs/2026-11-19-stringbed-design.md` — the approved design
2. `docs/racquet-roster.md` — the 358 racquets, their sources and trust notes
3. `docs/superpowers/plans/2026-11-19-stringbed-v1.md` — the build plan
4. `docs/roadmap.md` — future customization and visual styles

Rules that are easy to break by accident:

- No brand logos, wordmarks or string stencils in any asset or on the site.
- Never hand-edit files in `assets/`. They are generated from `racquets/**/*.json` and
  `strings/**/*.json` (and the spool, from `src/core/spool.ts`).
- Part names and the coordinate convention in the design doc are a public contract.
- `src/core` must not import from `src/styles` or `site`.
- Design the gallery with the Impeccable skill (`.claude/skills/impeccable`). Its launcher
  downloads a binary; it has not been run here yet (see the design doc's open items).

Commands (Bun for everything; there is no npm lockfile): `bun install`, `bun test`,
`bun run typecheck`, `bun run generate` (`--check` to verify `assets/` matches the specs, as CI
does), `bun run dev` (gallery at `/stringbed/`), `bun run build` (static site in `dist/`,
deployed to Pages from `main`).

Layout: `racquets/` specs → `src/core` (model, named parts) → `src/styles` + `src/export`
(GLB) → `scripts/generate.ts` writes `assets/`; `site/` is the gallery and reads
`assets/catalog.json`.
`strings/` holds one JSON per string (`docs/string-roster.md`, `src/string-spec.ts`); `generate` writes them to `assets/strings.json` and builds `assets/models/string-spool.glb` (`src/core/spool.ts`).
`src/restring.ts`, `tape.ts`, `mass.ts` and `play.ts` are the browser-safe build logic (strings on the bed, lead tape, weight/balance/swingweight, play estimate); all but `play.ts` are exported from `src/index.ts`. In `site/src`, `routes.ts` holds every `#/` address; `strings-page.ts`, `string-view.ts` and `strings-data.ts` are the Strings room; `build-page.ts` is the Build page and `build-state.ts` holds the Build page's address (`#/build/<racquet>?v=1&...`, stable: do not change what a `v=1` link means). Design: `docs/superpowers/specs/2026-11-24-strings-and-build-design.md`.
`placeholders/` holds research-only records for racquets not yet modelled
(see `docs/placeholder-roster.md`); no model is built from it, but `generate` copies it into
the catalog and the gallery lists it as "No model yet".
