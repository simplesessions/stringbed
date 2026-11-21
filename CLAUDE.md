# stringbed

Parametric tennis racquet asset library. Public repo: `simplesessions/stringbed`.

Start here, in this order:

1. `docs/superpowers/specs/2026-11-19-stringbed-design.md` — the approved design
2. `docs/racquet-roster.md` — the 47 racquets, their sources and trust notes
3. `docs/superpowers/plans/2026-11-19-stringbed-v1.md` — the build plan
4. `docs/roadmap.md` — future customization and visual styles

Rules that are easy to break by accident:

- No brand logos, wordmarks or string stencils in any asset or on the site.
- Never hand-edit files in `assets/`. They are generated from `racquets/**/*.json`.
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
`assets/catalog.json`. `placeholders/` holds research-only records for racquets not yet modelled
(see `docs/placeholder-roster.md`); no model is built from it, but `generate` copies it into
the catalog and the gallery lists it as "No model yet".
