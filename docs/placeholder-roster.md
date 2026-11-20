# Placeholder roster

Racquets we know about but have not modelled. One JSON file per racquet in
`placeholders/<brand>/<id>.json`, validated by `src/placeholders.ts`. No model is built from
them: `bun run generate` copies them (without `notes`) into `assets/catalog.json` as
`placeholders`, and the gallery lists them under the wall as "No model yet", each with a spec
page and its sources but no 3D view or download. `tests/placeholders.test.ts` checks that ids
are unique and never reuse a library id from `racquets/`.

Researched 2026-11-20 by web search and retailer pages. **Every record is `verified: false`.**
Four records were spot-checked against their cited page and matched (Prince Tour 98 2026,
Solinco Prizm 115, Wilson Defyer 100, archived Babolat Pure Strike 103). The adult product names
on a June 2023 capture of Tennis Warehouse's Babolat page were checked against the 2023 set:
every frame listed there has a record.

## What is here

| Brand | Current (on sale late 2026) | On sale in 2023 | Total |
|---|---|---|---|
| Babolat | 59 (22 junior) | 81 (28 junior) | 133 (7 in both) |
| Head | 72 (18 junior) | — | 72 |
| Prince | 45 (5 junior) | — | 45 |
| Wilson | 41 (5 junior) | — | 41 |
| Yonex | 43 (10 junior) | — | 43 |
| Solinco | 10 (1 junior) | — | 10 |

The 14 library racquets are not repeated here.

## Fields

- `generation` is the marketed label ("Gen9", "v10", "2023"); `releaseYear` is the actual launch
  year. They differ: the Babolat Pure Aero "2023" launched in August 2022.
- `onSaleIn` lists the years the racquet was confirmed on sale. `2026` means the current lineup;
  `2023` comes from 2023 Wayback Machine captures of Tennis Warehouse's and Tennis Express's
  Babolat pages. Older generations still on sale in 2023 are included, tagged with their own
  release year.
- `null` means no page we could read gave the value. Nothing was estimated or converted. Strung
  weight and balance (all Tennis Warehouse publishes) are in `notes`, never in `specs`. A few
  `specs` weights and balances come from pages that do not say strung or unstrung (Babolat Pure
  Aero 98 2023, Evo Aero, Pure Aero Rafa and Rafa Origin balance, Solinco Blackout V2 110 and
  Prizm 115, Yonex Percept Game); each is flagged in its `notes`.
- `beamMm` is in the order the retailer lists it; tip / mid / shaft is not confirmed for
  variable beams.
- Colour variants of the same frame are one record (`colourway`, `notes`). Special editions with
  their own name (Wimbledon, Spectra) are separate.
- Ids are `brand-model[-generation][-year]`. When no year was found the id has none, or a
  generation tag (`-2021gen`, `-prev`). A trailing year in an id is sometimes the marketed label
  or a retailer title, not `releaseYear` (for example the Pure Aero "2023" family is `-2022`;
  some Evo and junior ids carry a year while `releaseYear` is null). Filter on `onSaleIn`, not on
  ids. Treat placeholder ids as provisional until a racquet is promoted into `racquets/`.
- New cosmetics of an otherwise identical frame across years (Boost Aero, Boost Strike, Aero and
  Drive juniors) are separate records, one per year seen.

## Known gaps

- Head (added later the same day) comes from Tennis Warehouse US only; head.com and Tennis Warehouse
  Europe rate-limited, so Head has no unstrung balance and one unstrung weight (Gravity Team).
  Superseded 2024 Speed, Extreme and Boom frames still on sale are kept and noted; Zverev and
  Legend cosmetics are skipped.
- Unstrung weight is known for 93 of the first 272, unstrung balance for fewer. Sites that publish
  unstrung figures (Merchant of Tennis, Tennis Express, Racquet Guys, Tennis Point) rate-limited
  every request.
- 118 records have no release year; 64 have no beam widths.
- Shaky records, flagged in `notes`: Solinco Blackout V2 265 may not exist; several Prince
  Warrior, Beast and Hydrogen models are backed only by a Tennis Warehouse Europe catalogue
  title; Prince Hydrogen Skulls graphics need checking against the no-logos rule.
- Probably exist but not found on a readable page, so absent: Yonex EZONE 98L, VCORE Junior 25.
- Coverage is US retail for the 2023 Babolat set.
- Left out on purpose: Wilson v9 holdovers and limited editions (US Open, Fall Layers, Laver
  Cup, Roland-Garros), Solinco V1 old stock, Babolat 2-packs (same frames as the singles).
- Not found on sale at Tennis Warehouse, so absent (not proof of discontinuation): Wilson Shift,
  Clash 98, Ultra 108, Pro Staff X, Six.One, RF 97, Blade 98S v10; Prince Synergy, Tour 95,
  Tour 98 Lite, Phantom 97P, Beast 98 / 104, O3 Beast; Babolat Pure Aero Rafa, Pure Aero VS,
  Pure Drive Tour and Pure Drive 110 in the current lineup (they are in the 2023 set).

## Cross-check of the library (no library file changed)

- **Wilson Pro Staff 97 v14** is no longer sold at Tennis Warehouse; the Pro Staff 97 Classic
  (same specs, black cosmetic) replaced it.
- **Yonex Percept 97**: the library has `year: 2025`, which is the Midnight Navy colourway; the
  frame launched in 2023.
- **Wilson Blade 98 v10**: Tennis Warehouse says "new for 2026"; the library has 2025.
- **Yonex EZONE 100**: Tennis Warehouse labels it "(2025)"; "8th gen" (the library's label) was
  seen only in search-result titles.
- **Babolat Pure Strike 98**: Gen4 (January 2024) is still the newest; the 2025 Carbon Grey is a
  cosmetic.
- Everything else (head, length, pattern, beam, generation) matched where a page gave it.
