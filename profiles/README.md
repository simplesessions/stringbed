# Racquet profiles

Editorial research on the current top racquets: a skimmable summary plus what each frame is good
for. **Data only**: nothing here is read by the generator, the build or the site yet, and nothing
here changes `racquets/` or `assets/`. The gallery design will decide where it is shown.

One file per brand, `profiles/<brand>.json`: an array of profile objects, one per **frame** (the
spec id in `racquets/`), not per size. Size-specific notes go in `variantNotes`.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Id of a spec in `racquets/` (must exist). |
| `summary` | string | One paragraph, 45-90 words. Plain and specific, not sales copy; say who it suits and the trade-off. |
| `bestFor` | string[] | 1-4 tags from the vocabulary below, most defining first. |
| `playerLevel` | string[] | Any of `beginner`, `intermediate`, `advanced`. |
| `playStyle` | string | Short phrase, e.g. "heavy-topspin baseliner", "all-court shotmaker". |
| `feel` | string | A short phrase, e.g. "soft and muted", "crisp and firm". |
| `ratings` | object | `power`, `spin`, `control`, `comfort`, `stability`, `maneuverability`, `feel`: integers 1-5. Editorial: our reading of review consensus, relative to other adult frames in this set, not lab data. |
| `compared` | string[] | 0-3 ids of the closest alternatives in this library (ids in `racquets/`). |
| `variantNotes` | object | Optional: `{ "<variant label>": "one line" }` for the notable sizes/weights. |
| `released` | string | Launch month/year as best sourced, e.g. "2026-01". Optional if unknown. |
| `confidence` | `high` / `medium` / `low` | How well the claims are backed by the sources. |
| `sources` | string[] | URLs actually read (reviews, retailer pages, brand pages). At least two where possible. |
| `researchedOn` | string | ISO date. |

## `bestFor` vocabulary

`spin`, `power`, `control`, `comfort`, `stability`, `maneuverability`, `feel`, `touch`,
`forgiveness`, `serves`, `volleys`, `groundstrokes`, `all-court`, `baseline`, `net-play`.

## Rules

- Do not copy review text; paraphrase and compress. No brand-marketing phrases ("unleash", "game-changing").
- Do not state a claim that no source supports. When reviews disagree, say so or lower `confidence`.
- Numeric specs (head size, weight, pattern) live in `racquets/`, so do not repeat them in the summary
  beyond what makes a sentence readable.
- No endorsement or sponsor claims unless a source states them.
