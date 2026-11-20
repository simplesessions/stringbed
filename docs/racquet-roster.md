# Racquet roster (v1)

Fourteen racquets: three each for Yonex, Babolat, Wilson and Prince, two for Solinco. This is the research input for the spec files in
`racquets/`.

**Read the trust column.** Specs (head, pattern, beam, weight, generation) were checked against
retailer pages and search snippets on 2026-11-19 (Tennis Warehouse and others; manufacturer sites were mostly
unreachable). **No product photos were viewed**, so every colourway, accessory colour, head aspect
ratio and throat/bridge style is *estimated*, and every spec file carries `verified: false`. A
later likeness-review task checks photos and flips `verified`.

Beam widths are tip / mid / shaft in mm. All racquets are 27 in long unless noted.

## Yonex

Shared identity: the **isometric** head, visibly squared off across the top compared with
every other brand here. Get this right before anything else.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| EZONE 100 (2025 generation) | 100 | 16×19 | 24.5 / 26.5 / 23 | ellipse | Bright blue, darker blue/black accents | Thick, rounded power beam; widest at mid-head | Specs verified 2026-11-19 (retailer pages); colourway estimated |
| VCORE 100 (2026 generation) | 100 | 16×19 | 24 / 26 / 23 | aero | Ruby red with black | Aero fins at the head tip; slim, flattened shaft | Specs verified 2026-11-19 (TW page); colourway estimated; **aero fins unconfirmed** on any page, kept per the design doc |
| Percept 97 | 97 | 16×19 | 21 / 21 / 21 | box | Midnight navy (was olive green) | Thin, constant box beam; smallest head of the Yonex three | Specs verified 2026-11-19 (retailer snippets; 16×19 not seen on a page); colourway estimated |

## Babolat

Shared identity: oval heads, a pronounced woofer-style grommet band, strong single-colour
schemes.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Pure Aero 100 (2026) | 100 | 16×19 | 23 / 26 / 23 | aero | Yellow with black | Flattened aero beam, the most distinctive cross-section in the set | Specs verified 2026-11-19 (TW); colourway estimated |
| Pure Drive 100 (2025) | 100 | 16×19 | 23 / 26 / 23 | ellipse | Blue | Thick elliptical beam; the archetypal "tweener" silhouette | Specs verified 2026-11-19 (retailer snippets); colourway estimated |
| Pure Strike 98 16×19 (4th gen) | 98 | 16×19 | 21 / 23 / 21 | box (rounded corners) | Grey with neon red (Babolat US page; was recalled as white/orange) | Squarer, thinner beam than the other two | Specs verified 2026-11-19 (Babolat US page); colourway estimated; no newer generation checked |

## Wilson

Shared identity: oval heads, restrained matte paint, thin constant beams on the player
frames.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Blade 98 16×19 v10 | 98 | 16×19 | 21.5 / 21.5 / 20.5 | box | "Championship Green" with an infrared accent | Thin box beam; dark green | Specs verified 2026-11-19 (retailers disagree: some list a flat 21); colourway estimated |
| Clash 100 v3 | 100 | 16×19 | 24.5 / 24.5 / 24.5 | ellipse | Standard colourway not found (red is the Reverse edition); estimated black/charcoal | Thick constant beam; long, flexible-looking throat | Specs verified 2026-11-19 (snippets); colourway estimated and uncertain |
| Pro Staff 97 v14 | 97 | 16×19 | 21.5 / 21.5 / 21.5 | box | Copper-bronze with black | Classic box beam; leather-look grip; small head | Specs verified 2026-11-19 (retailers); colourway estimated (Bronze colour-shift) |

Blade 98 and Pro Staff 97 are genuinely similar frames; the specs differentiate them only by estimated head aspect (Blade ~1.38, more elongated; Pro Staff ~1.30, rounder, more traditional) and colourway.

Wilson sells many limited cosmetics (US Open, Roland Garros and others). Use the standard
launch colourway for each.

## Solinco

Shared identity: the **tiger-camo** paint pattern. It is the reason the `camo` paint pattern
exists in the spec.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Whiteout V2 305 | 98 | 16×19 | 21.7 / 21.7 / 21.7 | box | White with grey tiger camo | Thin box beam; white | Specs verified 2026-11-19 (TW); camo colours estimated |
| Blackout V2 300 | 100 | 16×19 | 23.5 / 26 / 23 | ellipse | Black with tiger camo | Thick power beam; black | Specs verified 2026-11-19 (TW EU, TennisNerd); camo colours estimated |

**Shadow dropped.** Solinco's current line has no Shadow (only a discontinued 2018-2020
model). The Blackout V2 285 has geometry identical to the 300 (100 sq in, 23.5 / 26 / 23,
16×19), differing only in weight and balance, so it is not a visibly different icon.
Solinco therefore ships with **two** racquets, and the library has **14**.

## Prince

Shared identity: thin, tapering beams and, on some lines, **O-Ports** (large oval string
holes at 3, 9 and sometimes other positions on the hoop).

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| O3 Phantom 100X (2025) | 100 | 16×18 | 19 / 20 / 20 | tapered-box | Matte black (estimated) | Thin variable beam; O-Ports. Replaces the 18×20 Phantom 100X (22 / 20.5 / 18, 2024), which is no longer the newest | Specs verified 2026-11-19 (TW); weight (305 g) estimated; colourway estimated |
| Tour 100 290g (2026) | 100 | 16×18 | 22 / 23 / 20 | box (rounded corners) | Black (retailers); gold throat accent is a guess | Open 16×18 pattern; mid-thickness beam | Specs verified 2026-11-19 (TW US and EU); colourway unconfirmed |
| Ripstick 100 | 100 | 16×18 | 27 / 25.5 / 22 | ellipse | Red (retailers); the red-to-orange two-tone is an estimate | O-Ports; thick beam; the loudest paint in the set | Specs verified 2026-11-19 (retailers agree on beam); colourway estimated |

Note: the tip / mid / shaft ordering of the O3 Phantom (19 / 20 / 20) and Tour 100 (22 / 23 / 20) beam widths is not stated by the sources; the order here is an assumption.

## Sources seen during design research

- Tennis Warehouse, best racquets of 2026: https://www.tennis-warehouse.com/Best_Racquets_of_2026/catpage-BESTRAC26.html
- TennisNerd, best racquets of 2026 so far: https://www.tennisnerd.net/gear/racquets/the-best-tennis-racquets-of-2026-so-far/65679
- Wilson Blade series guide 2026: https://www.sturdyracquets.com.au/blogs/guide/wilson-blade-series-guide
- Wilson Clash v3 vs Blade v10: https://tennisexpress.com/blogs/news/wilson-clash-v3-vs-blade-v10-comparison
- Solinco Blackout V2 preview: https://www.tennis.com/news/articles/racquet-preview-solinco-unveils-blackout-v2
- Solinco Whiteout V2 305 XTD: https://www.solincosports.com/equipment/whiteout-v2-305-xtd
- Prince racquet guide: https://www.tennis-warehouse.com/learning_center/Gear_Guides/Tennis_Racquets/best_prince_racquet_for_me.html
- Prince Tour 100 290g 2026: https://www.tennis-warehouse.com/Prince_Tour_100_290g_2026/descpage-PTR629.html
- Yonex Percept navy: https://tennisexpress.com/blogs/news/yonex-percept-tennis-racquets-midnight-navy
