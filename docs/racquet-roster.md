# Racquet roster (v1)

Fourteen racquets: three each for Yonex, Babolat, Wilson and Prince, two for Solinco. This is the research input for the spec files in
`racquets/`.

**Read the trust column.** Specs (head, pattern, beam, weight, generation) were checked against
retailer pages and search snippets on 2026-11-19 (Tennis Warehouse and others; manufacturer sites were mostly
unreachable). In the likeness review (also 2026-11-19) the product photo of each exact model was
viewed (Tennis Warehouse product pages; Racquet Guys for the Pro Staff 97 v14, which Tennis
Warehouse no longer lists; Babolat's own page as a second check for the Pure Strike), and the
colourway, colour placement, grip and trim colours in every spec were corrected against it. Every
spec now carries `verified: true` and lists that photo page in `sources`. Head aspect ratios were
compared by eye only; beam widths were not changed (no photo contradicted them).

Beam widths are tip / mid / shaft in mm. All racquets are 27 in long unless noted.

## Yonex

Shared identity: the **isometric** head, visibly squared off across the top compared with
every other brand here. Get this right before anything else.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| EZONE 100 (2025 generation) | 100 | 16×19 | 24.5 / 26.5 / 23 | ellipse | Medium "Blast Blue" with a navy top, lighter blue at the sides and shaft, a small aqua accent low on the hoop; **white grip** | Thick, rounded power beam; widest at mid-head | Specs verified 2026-11-19 (retailer pages); colourway checked against product photo 2026-11-19 (TW EZ10BB) |
| VCORE 100 (2026 generation) | 100 | 16×19 | 24 / 26 / 23 | aero | All ruby red, tonal; **white grip** (no black: the earlier estimate was wrong) | Aero fins at the head tip; slim, flattened shaft | Specs verified 2026-11-19 (TW page); colourway checked against product photo 2026-11-19 (TW VC108G); **aero fins** not visible in the photo, kept per the design doc |
| Percept 97 | 97 | 16×19 | 21 / 21 / 21 | box | "Midnight Navy" reads as slate violet in the photo, iridescent lavender/violet/blue down the hoop sides; black grip | Thin, constant box beam; smallest, longest head of the Yonex three | Specs verified 2026-11-19 (retailer snippets; 16×19 not seen on a page); colourway checked against product photo 2026-11-19 (TW PERM97) |

## Babolat

Shared identity: oval heads, a pronounced woofer-style grommet band, strong single-colour
schemes.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Pure Aero 100 (2026) | 100 | 16×19 | 23 / 26 / 23 | aero | Slate grey with two neon-yellow bands low on the hoop sides (the 2026 cosmetic is not the old yellow/black) | Flattened aero beam, the most distinctive cross-section in the set | Specs verified 2026-11-19 (TW); colourway checked against product photo 2026-11-19 (TW BPAR26) |
| Pure Drive 100 (2025) | 100 | 16×19 | 23 / 26 / 23 | ellipse | Sky blue with a navy top and two navy bands low on the hoop sides | Thick elliptical beam; the archetypal "tweener" silhouette | Specs verified 2026-11-19 (retailer snippets); colourway checked against product photo 2026-11-19 (TW BPD25R) |
| Pure Strike 98 16×19 (4th gen) | 98 | 16×19 | 21 / 23 / 21 | box (rounded corners) | Metallic grey, darker throat and top, two neon-red bands low on the hoop sides | Squarer, thinner beam than the other two | Specs verified 2026-11-19 (Babolat US page); colourway checked against product photos 2026-11-19 (TW PS9816 "Carbon Grey" and Babolat's Gen4 page, both Grey / Neon Red); no newer generation checked |

## Wilson

Shared identity: oval heads, thin constant beams on the player frames.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Blade 98 16×19 v10 | 98 | 16×19 | 21.5 / 21.5 / 20.5 | box | Metallic emerald green, deeper green throat, a thin infrared tick low on each side; **green grip** | Thin box beam; green all over | Specs verified 2026-11-19 (retailers disagree: some list a flat 21); colourway checked against product photo 2026-11-19 (TW WB9810) |
| Clash 100 v3 | 100 | 16×19 | 24.5 / 24.5 / 24.5 | ellipse | Black with infrared-orange at the bridge and throat | Thick constant beam; long, flexible-looking throat | Specs verified 2026-11-19 (snippets); colourway checked against product photo 2026-11-19 (TW CL103V) |
| Pro Staff 97 v14 | 97 | 16×19 | 21.5 / 21.5 / 21.5 | box | Dark chocolate brown with a copper edge; **tan leather-look grip** | Classic box beam; leather-look grip; small head | Specs verified 2026-11-19 (retailers); colourway checked against product photo 2026-11-19 (Racquet Guys, WR125711U "Copper Iridescent"; TW lists only the later Classic) |

Blade 98 and Pro Staff 97 are genuinely similar frames. The photos show their heads are close in shape (Blade aspect lowered from 1.38 to 1.35; Pro Staff 1.30); they are told apart by colourway: green frame and green grip against dark brown frame and tan grip.

Wilson sells many limited cosmetics (US Open, Roland Garros and others). Use the standard
launch colourway for each.

## Solinco

Shared identity: the **tiger-camo** paint pattern. It is the reason the `camo` paint pattern
exists in the spec.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Whiteout V2 305 | 98 | 16×19 | 21.7 / 21.7 / 21.7 | box | White with faint pale-grey tiger camo, black over the top of the hoop; black grip | Thin box beam; white | Specs verified 2026-11-19 (TW); colourway checked against product photo 2026-11-19 (TW WTOCAH) |
| Blackout V2 300 | 100 | 16×19 | 23.5 / 26 / 23 | ellipse | Charcoal with grey tiger-camo streaks, solid black over the top of the hoop | Thick power beam; dark | Specs verified 2026-11-19 (TW EU, TennisNerd); colourway checked against product photo 2026-11-19 (TW BKOCAH) |

**Shadow dropped.** Solinco's current line has no Shadow (only a discontinued 2018-2020
model). The Blackout V2 285 has geometry identical to the 300 (100 sq in, 23.5 / 26 / 23,
16×19), differing only in weight and balance, so it is not a visibly different icon.
Solinco therefore ships with **two** racquets, and the library has **14**.

## Prince

Shared identity: thin, tapering beams and, on some lines, **O-Ports** (a row of large slotted
holes down each side of the hoop, centred on 3 and 9 o'clock; five to eight per side on the O3 frames).

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| O3 Phantom 100X (2025) | 100 | 16×18 | 19 / 20 / 20 | tapered-box | Olive green, darker top, lighter lime-olive panels on the sides; khaki grip (not black) | Thin variable beam; a row of O-Ports down each side. Replaces the 18×20 Phantom 100X (22 / 20.5 / 18, 2024), which is no longer the newest | Specs verified 2026-11-19 (TW); weight (305 g) estimated; colourway checked against product photo 2026-11-19 (TW PO310X) |
| Tour 100 290g (2026) | 100 | 16×18 | 22 / 23 / 20 | box (rounded corners) | Gloss black with orange lettering low on the hoop sides and a small orange mark at the tip (no gold throat) | Open 16×18 pattern; mid-thickness beam | Specs verified 2026-11-19 (TW US and EU); colourway checked against product photo 2026-11-19 (TW PTR629) |
| Ripstick 100 | 100 | 16×18 | 27 / 25.5 / 22 | ellipse | All red, including the grip and grommets (no black throat, no orange) | A row of O-Ports down each side; thick beam; the loudest paint in the set | Specs verified 2026-11-19 (retailers agree on beam); colourway checked against product photo 2026-11-19 (TW 25RIPH) |

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
