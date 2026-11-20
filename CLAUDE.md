# stringbed

Parametric tennis racquet asset library. Public repo: `simplesessions/stringbed`.

Start here, in this order:

1. `docs/superpowers/specs/2026-11-19-stringbed-design.md` — the approved design
2. `docs/racquet-roster.md` — the 15 racquets; note which values are unverified
3. `docs/superpowers/plans/2026-11-19-stringbed-v1.md` — the build plan
4. `docs/roadmap.md` — future customization and visual styles

Rules that are easy to break by accident:

- No brand logos, wordmarks or string stencils in any asset or on the site.
- Never hand-edit files in `assets/`. They are generated from `racquets/**/*.json`.
- Part names and the coordinate convention in the design doc are a public contract.
- `src/core` must not import from `src/styles` or `site`.
- Design the gallery with the Impeccable skill (`.claude/skills/impeccable`).
