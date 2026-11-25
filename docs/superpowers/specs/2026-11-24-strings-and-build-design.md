# Strings, and Build my racquet — design

Status: built 2026-11-24. The text below is the design as written before the build; what came out differently:

- 73 strings, not 63 (see the [string roster](../../string-roster.md)).
- The dampener sits below the lowest cross, outside the crossed strings.
- Tennis Only's racquet numbers (strung weight, balance, swingweight, stiffness) were read, then
  withdrawn: its terms forbid reproducing its content. Weight and balance are known together for 10
  racquets, all from the makers' pages; none carries a swingweight (see the
  [racquet roster](../../racquet-roster.md)).

Two plans, in order, each shippable alone:

1. [Strings](../plans/2026-11-24-strings.md): the string library, its browser, search.
2. [Build my racquet](../plans/2026-11-24-build-page.md): the interactive page.

Picks up item 1 of the [roadmap](../../roadmap.md).

## Intent (the owner's words, condensed)

- Real strings from at least 10 of the top brands, to try on whatever racquet.
- A string browser very like the racquets': click a string for info and ratings. Its model is a
  spool for now, in the string's colour. Strings are in the global search.
- A separate **build my racquet** page, opened from whichever racquet you are viewing: strings,
  tension, etc.; stick a piece of lead tape somewhere; it keeps showing weight, balance, etc. Very
  interactive. It also has the racquet's info and rating, and what your combination of strings will
  do on that racquet.
- Every setting is in the URL as you change it, so you can send it to someone.
- Cool sound effects.
- Download does not use the chosen strings yet.
- Research beyond Tennis Warehouse, and never hammer a site.

## Goals

1. About 60 strings, 14 brands, sourced facts, 1-5 editorial ratings.
2. String floors and pages that behave like the racquet ones, with a spool in the string's colour.
3. One search over racquets and strings.
4. A build page for any of the 358 racquets and their colourways: strings (hybrids too), tension,
   lead tape, overgrip, dampener.
5. Live weight, balance, swingweight and what changed, from real masses at real positions.
6. Live "what this does" on that racquet: ratings that move, each with its reason, and 1-3 sentences.
7. The link reproduces the build exactly.
8. Sounds that come from the thing: a pluck whose pitch is the string bed's own.

## Non-goals

Downloading a build; price, stock, shop links; accounts or saved builds; a string picker on the
ordinary racquet page (it gets a "Build this racquet" button instead); woven or twisted string
geometry; lead inside the butt cap; leather grips; undo history.

## Anti-goals

- **Facts from memory**, or a guessed weight shown as a published one. A missing fact says so.
- **Pretending to be a lab.** Weight, balance and swingweight are arithmetic and shown as such. How
  it will play is our estimate and is always labelled as one, with its reasons.
- **Logos, stencils.** Names are plain text.
- **Arcade sounds.** `sound.ts` already rules: no sliding pitch, quiet, physical.
- **Getting blocked.** See Research rules.

## Approaches

**Restringing in the 3D view**

| | Trade-off | Verdict |
|---|---|---|
| Recolour only | Trivial, but a 1.15 hexagon and a 1.35 round look the same | Rejected |
| **Restring from the file**: read the string lines back from the published mesh, rebuild with the chosen gauge and shape | No GLB changes; works on pinned v1.0.0 files. Needs strings straight and axis-aligned; a test pins that on every file | **Chosen** |
| Write the lines into each GLB as `extras` | Explicit, but rewrites 364 GLBs (13 MB of history) and adds 1 KB each | Fallback |

**Weight and balance**

| | Trade-off | Verdict |
|---|---|---|
| **Point masses on the published numbers**: racquet as published, plus strings, tape, grip and dampener at their own positions | Exact arithmetic for what you add. Needs the published weight and balance | **Chosen** |
| Mass from the mesh volume | Needs no data, but frames are hollow and layups secret: the answer would be wrong | Rejected |

**What the combination does**

| | Trade-off | Verdict |
|---|---|---|
| **Rules over the two sets of ratings**: racquet rating, shifted by string, tension, gauge and mass, each shift with its reason | Transparent, testable, works for every pair. Coefficients are our judgement | **Chosen** |
| Written copy per pair | 358 × 63 pairs | Rejected |
| A lab-data model | TWU and similar databases restrict reuse or were not cleared | Rejected for now |

**Page shape**: a separate page, the owner's choice. The 3D viewer is the one the racquet page uses
(two WebGL contexts at most, still).

## Checked on the real files (2026-11-24, scratch scripts, repo untouched)

| Claim | Result |
|---|---|
| String lines can be read back from the GLBs | 364 of 364 files, worst error 0.018 mm, 0.04 ms each |
| String mass from length × gauge × density is believable | Pure Aero 100: 9.3 m, 1.25 mm polyester 15.8 g, nylon 13.0 g, gut 14.9 g; guides say strings add 15-20 g |
| Its effect on swingweight | +27.7 kg·cm² at a centroid 513 mm from the butt |
| Pluck pitch, centre main at 52 lb | 571 Hz polyester, 629 Hz nylon |
| Tape can be laid on any hoop | 25,776 rays from head centre, all hit the frame, 0.11 ms each |
| Weight known | 132 of 358 racquets |
| Balance or swingweight known | 0 of 358 |
| Ratings known | 212 of 358 racquets (37 of 87 frames) |

Densities used above (polyester 1380, nylon 1140, gut 1300 kg/m³) and the 34 mm of string allowed per
string for wrapping the frame are first guesses to be sourced in the build plan.

**Gaps are handled, not hidden.** No published weight or balance: the page shows what your changes
add and where, and lets you type in your own racquet's measured weight and balance (kept in the
link). No ratings: the page shows up and down arrows instead of a score.

## Masses and formulas

- Butt cap is the origin and the racquet runs along +Y, so a point's `y` in mm **is** its balance.
- String: π/4 · gauge² · density · length, spread along the recovered lines.
- Balance = Σ(mass · y) / Σ mass. Points = (length/2 − balance) / 3.175 mm, head light if positive.
- Swingweight about 101.6 mm from the butt: Σ kg · (y_cm − 10.16)².
- Twist added: Σ kg · x_cm².
- Pitch of the centre main: √(T/μ) / 2L.
- Lead tape: 0.25 g per inch of ¼ in tape (retailer listings, search snippets only; to be confirmed).

## What it does: the estimate

Rating = racquet's rating + shifts, kept between 1 and 5. A reference build (all string ratings 3,
52 lb, 1.25 mm, nothing added) shifts nothing. Mains count 0.65, crosses 0.35.

| Cause | Shift |
|---|---|
| String rating, per point above 3 | +0.35 on power, spin, control, comfort, feel |
| Tension, per 5 lb above 52 (limit ±3 steps) | power −0.25, control +0.2, comfort −0.25, spin −0.05 |
| Gauge, per 0.05 mm thinner than 1.25 | spin +0.08, feel +0.08, power +0.05, control −0.04, durability −0.3 |
| Swingweight added, per 10 kg·cm² (tape, grip, dampener; strings against a 1.25 polyester bed) | stability +0.3, manoeuvrability −0.35, power +0.1 |
| Twist added, per 0.5 kg·cm² | stability +0.1 |

Durability starts from the strings' own rating. All numbers are Claude's call. Directions follow the
usual coaching guidance; evidence that tension buys control is thin (a peer-reviewed forehand study
turned up in search and reportedly found no simple link; it could not be opened, so it is unread),
which is why control moves least. The page says: "Our estimate from the ratings and your settings.
Not a measurement."

## The address

`#/build/<racquet>[/<colourway>]?v=1&s=…&t=…&l=…&g=…&d=…&w=…&b=…`

| Key | Meaning | Example |
|---|---|---|
| `s` | string.colour.gauge×100, `~` before a different cross | `luxilon-alu-power.silver.125~babolat-touch-vs.natural.130` |
| `t` | tension in lb, `~` before a different cross | `52~50` |
| `l` | lead pieces joined by `~`: zone, position, `m` if mirrored, length mm, layers | `h90m.40.2~l150m.60.1` |
| `g` / `d` | overgrip / dampener colour id | `white` / `red` |
| `w` / `b` | your own unstrung grams / balance mm | `305` / `320` |

Zones: `h` hoop, degrees clockwise from 12 o'clock; `l`/`r` outer side of the left/right arm or
handle, mm from the butt. Anything unreadable is dropped and the rest is kept. String pages are
`#/strings`, `#/strings/b/<brand>`, `#/strings/<id>[/<colour>]`.

## Page sketch (look and layout are Impeccable's)

```
┌ Build · Wilson Blade 98 v10 ─────────────── [Change racquet] [Copy link] [Sound] ┐
│                                          │ STRINGS  ● ALU Power  silver  1.25     │
│                                          │          crosses: ● Touch VS 1.30      │
│          [3D, tape shown,                │ TENSION  ───●──── 52 lb   crosses 50   │
│           balance point marked]          │ LEAD     12 · 3&9 · 10&2 · throat      │
│                                          │          3&9  4 cm  ×2  [−][+] [remove]│
│   [Add tape: click the frame]            │ GRIP ○ ● ○   DAMPENER ● ○ ○            │
├──────────────────────────────────────────┼────────────────────────────────────────┤
│ 329 g (+24)  331 mm · 4 pts HL  SW 322   │ WHAT IT DOES                           │
│  ──────▲────────  balance beam tips      │ Spin    ●●●●◐  + ALU Power, 1.25       │
│                                          │ Comfort ●●◐    − 52 lb polyester       │
└──────────────────────────────────────────┴ About this racquet: specs, write-up ───┘
```

## Sounds

Off by default and remembered, as now; the build page carries a labelled switch. Each is data in
`sound.ts`, peak level at most 0.16, no pitch slides.

| Moment | Sound |
|---|---|
| Press Pluck, or tap the bed | Pluck at the bed's own pitch; a dampener cuts its ring |
| Tension | One ratchet click per lb, then the new pluck on release |
| Restring | One muted pluck at the bed's pitch |
| Tape on / off | A papery stroke, then a soft thumb press / the stroke |
| Overgrip | One long soft stroke |
| Dampener on / off | The bed's pluck, muted / ringing again |
| Open a string | A plastic spool set on the counter |
| Copy link | A wooden stamp |

## Research rules (both plans)

1. Order: the maker's own site; then Tennis Only, Racquet Guys, Merchant of Tennis, Tennisnuts,
   Tennis Express, Tennisnerd and other reviewers. Tennis Warehouse only for a fact the others lack.
2. One request at a time per site, whoever is asking: work is split **by site, not by brand**, so no
   two workers share one. At least 20 s between requests to a site; Tennis Warehouse at least 60 s,
   and at most 40 pages a day.
3. Keep every page read (scratch folder, outside the repo). Never fetch a URL twice.
4. 429: honour Retry-After once. A second 429, a 403 or a bot check: leave that site for the day. No
   workarounds. Note it and use another source.
5. Read a site's terms before taking more than a handful of facts from a database. Not used:
   Racqix (terms forbid extracting its database) and TWU's lab numbers (terms unread).
6. Facts are restated, never copied as prose. Every fact's page is in `sources`.

(Met today: gammasports.com answered 429 twice and PMC showed a bot check; both were left alone.)

## Traps found while reading the code

1. Part nodes carry a quantisation scale and offset; new geometry in metres needs the transform reset.
2. Clones share materials with the cached source and the thumbnails. Never recolour in place.
3. The Line look caches an unlit copy per material with the colour copied once. A fresh material per
   change avoids 2 and 3.
4. The Pixel look divides string colour by its brightest channel, so **black strings draw near-white**.
5. The route patterns reject `?`, and `#/build/x` and `#/strings/x` would parse as a racquet and its
   colourway. No racquet id is `b`, `build` or `strings` today; a test keeps it so.
6. Thumbnails frame a fixed 29 in, and the lights and alcove are sized for a racquet. A spool needs
   its own framing and scale.
7. Browsers throttle `history.replaceState` (Safari: 100 calls in 30 s). A dragged slider must batch.
8. Bytes: GLBs stay identical. `catalog.json` changes only when racquet facts are added.

## String roster (63 strings or more, 14 brands)

Names were read on Tennis Warehouse's brand pages on 2026-11-24, before the research rules. **Names
only are settled**; the pages were cut short and part of the reading was machine-summarised. Every
fact is sourced afresh under the rules.

| Brand | Strings | Read so far |
|---|---|---|
| Luxilon (6) | ALU Power, ALU Power Rough, 4G, Element, ECO Power, Natural Gut | ALU Power co-poly, silver, ice blue; Rough textured; ECO Power six-sided |
| Babolat (6) | RPM Blast, RPM Rough, RPM Team, RPM Power, Touch VS, Xcel | Touch VS natural gut; Xcel multifilament |
| Wilson (4) | NXT, Sensation, Revolve, Natural Gut | NXT multifilament, natural, black, orange |
| Solinco (all popular) | Hyper-G, Hyper-G Soft, Tour Bite, Confidential, Mach-10, plus every other popular current one (owner, 2026-11-24). Candidates to verify: Hyper-G Round, Tour Bite Soft, Tour Bite Diamond Rough, Revolution, Barb Wire, Outlast, Heaven, Vanquish, X-Natural | Hyper-G, Tour Bite, Confidential shaped co-poly; Hyper-G Round, Revolution, Barb Wire, Vanquish seen listed |
| Yonex (5) | PolyTour Pro, PolyTour Spin, PolyTour Rev, PolyTour Drive, Rexis Speed | Pro yellow, black, blue; Spin five-sided |
| Tecnifibre (5) | Razor Code, Black Code, X-One Biphase, NRG2, Triax | Black Code five-sided; NRG2, X-One multifilament |
| Head (5) | Hawk, Hawk Touch, Lynx Tour, Sonic Pro, Velocity MLT | Lynx Tour six-sided; Velocity multifilament |
| Prince (4) | Synthetic Gut Duraflex, Tour XP, Vortex, Premier Control | Duraflex in 11 colours; Vortex shaped |
| Dunlop (4) | Black Widow, Explosive Bite, Explosive Spin, Iconic All | Black Widow seven-sided |
| Gamma (4) | AMP Moto, Live Wire, Live Wire Professional, TNT2 | Moto shaped; Live Wire multifilament |
| Volkl (4) | Cyclone, Cyclone Tour, V-Star, V-Square | Cyclone gear-shaped; V-Square four-sided; V-Star round |
| Kirschbaum (3) | Max Power, Pro Line II, Xplosive Speed | Pro Line II black |
| Signum Pro (4) | Firestorm, Poly Plasma, Tornado, X-Perience | Tornado seven-sided |
| Toroline (4) | Caviar, O-Toro, Wasabi, Absolute | Wasabi square; Absolute black |

Next in line: Diadem, Ashaway. Left out because not found under the name people use: PolyTour Strike,
TGV, NT Max Plus, Ocho, Asterisk.

Sources read: Tennis Warehouse brand pages, e.g.
[Luxilon](https://www.tennis-warehouse.com/LuxilonString.html),
[Toroline](https://www.tennis-warehouse.com/Toroline_Tennis_Strings/catpage-TOROLSTR.html) (the other
twelve follow the first pattern; Signum Pro is `SignumString.html`);
[Racqix terms](https://www.racqix.com/en/terms). Seen as search results only:
[Gamma tape](https://www.merchantoftennis.com/products/gamma-lead-weight-tape-1-4-inch),
[strung weights](https://tenniscompanion.org/tennis-racquet-weight-and-balance/),
[tension study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11734973/).

## Decisions

Owner: separate build page; string browser like the racquets'; spool model; strings in search; state
in the URL; no restrung download yet; sounds; the research limits. Claude, open to change: 14 brands;
the estimate's coefficients; the rest of "etc." being overgrip and dampener; your-own-measurements;
sounds still off until switched on; no picker on the ordinary racquet page.

## Left to the builder

Layout and look (Impeccable), spool's shape within its budget, sound partials, sentence wording.
