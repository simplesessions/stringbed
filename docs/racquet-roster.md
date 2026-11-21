# Racquet roster (v1)

Three hundred racquets (79 frames): fifteen original (three each for Yonex, Babolat, Wilson and Prince, two for
Solinco, one Head) and two hundred and eighty-five promoted from the placeholder roster on 2026-11-20 (see "Added
2026-11-20" at the end). This is the
research input for the spec files in `racquets/`.

**Read the trust column.** Specs (head, pattern, beam, weight, generation) were checked against
retailer pages and search snippets on 2026-11-19 (Tennis Warehouse and others; manufacturer sites were mostly
unreachable). In the likeness review (also 2026-11-19) the product photo of each exact model was
viewed (Tennis Warehouse product pages; Racquet Guys for the Pro Staff 97 v14, which Tennis
Warehouse no longer lists; Babolat's own page as a second check for the Pure Strike), and the
colourway, colour placement, grip and trim colours in every spec were corrected against it. Every
spec now carries `verified: true` and lists that photo page in `sources`. Head aspect ratios were
compared by eye only; beam widths were not changed (no photo contradicted them).

**Check every angle, not just the face.** A face-on photo hides most of the paint: the beam's
outer edge (either side of the grommet channel), the inner string-side edge, and the underside
of the bridge. Before calling a colourway right, look at angled and side-on photos too (product
galleries usually have them), and compare the model turned to the same angles in the gallery.
Paint zones can target single faces (`faces`: outer, inner, front, back) and the grommet strip
can be a channel (`parts.grommets.channel`), so these differences can be modelled.
Example (Babolat Pure Aero 2026): the inner edge is slate, yellow only inside the two bands;
the bands wrap the face and outer edge with the dark grommet channel running through them; a
thin yellow line runs under the bridge; the throat-arm yellow is lettering, so it is left out.

**Variants (one frame, several sizes).** Racquets of the same line and generation that differ
only in head size, string pattern, beam or weight (Speed MP / Pro / Tour, Pure Aero 100 / 98)
are one spec file: the flagship is the base, with a `variantLabel` ("MP", "100"), and the others
are listed in `variants`, each with an `id`, a `label` and only the top-level fields that differ
(usually `model`, `specs`, sometimes `geometry`, `paint`, `sources`). Every variant is still
built and published under its own id and file name. The gallery shows one bay per frame and a
version picker on its page. A different generation (Phantom 100X 2024 vs O3 Phantom 100X 2025)
is a different frame, not a variant; the same frame in other paint is a colourway.

**Official colourways.** A spec names its own colourway in `colourway` (e.g. "Blast Blue") and
lists other official ones in `colourways`: each has an id, name, optional year, its own `paint`,
optional part-colour overrides and sources. Geometry is shared. Each colourway is generated as
`assets/<style>/<id>--<colourway>.glb`, listed under the racquet in `catalog.json`, and offered
as swatches on the racquet's page (`#/<id>/<colourway>`). Limited and event editions stay out;
only colourways the maker sells as standard. So far: Yonex EZONE 100 Espresso Brown (2026) and Wilson Clash 100 v3 Reverse (red; checked against TW WC103R face-on and side photos). The other racquets have no second standard colourway: retailers list one colour, and the rest are limited or event editions.

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
Solinco therefore ships with **two** racquets.

## Head

Shared identity: rounded heads and constant-thickness beams, darker cosmetic bases than the
other brands with large white panels; the 2026 Speed line pairs a near-black charcoal frame
with white hoop-side panels and a white grip. No logos or "SPEED" wordmark.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Speed MP (2026) | 100 | 16×19 | 23 / 23 / 23 | ellipse | Charcoal, almost black, with white panels on the upper hoop sides and a white lower shaft that runs all the way to the throat fork, its edge cutting diagonally across the bottom of each arm; **white grip** and white collar | Constant 23 mm rounded beam; rounded 100 sq in head; white side panels and the white fork are the fastest cues | Specs verified 2026-11-20 (TW page and review); colourway checked against product photos 2026-11-20 (TW HSPMP6 and Midwest 232026, six views) |

With the Speed MP added, the library had 15 racquets; it now has 47 (see below).

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

## Added 2026-11-20 (promoted from the placeholder roster)

Twelve more current racquets, chosen as different frames rather than weight variants of
racquets already here. Specs come from the placeholder records (Tennis Warehouse US); colourway
and colour placement come from the Tennis Warehouse product photo (face-on and side-on in one
image) and were then checked against gallery renders at one angle only. **Not yet checked
against more angled photos** (see the rule above). Beam order, head aspect, bridge shape and
cross-section are judged by eye, not measured. Unstrung weights are omitted (TW lists strung
only). Placeholder records for these were removed.

| Model | Head | Pattern | Colourway as modelled | Notes |
|---|---|---|---|---|
| Yonex Muse 100 (2026) | 100 | 16×18 | Pearl silver, light blue grommets, cream grip | New isometric family; 16×18 per TW (TennisNerd said 16×19) |
| Wilson Ultra 100 v5 (2025) | 100 | 16×19 | Electric blue, teal grommets, black grip | |
| Wilson Burn 100S v6 (2026) | 100 | 18×16 | Copper orange with a charcoal top of the hoop, black grip | Pattern kept as the placeholder lists it (mains×crosses 18×16) |
| Wilson Defyer 100 | 100 | 16×19 | Red-orange, lighter at the hoop top, thin white line under the bridge | New line, no generation |
| Wilson Clash 100 Pro v3 (2025) | 100 | 16×20 | Black, red under the bridge and in the grommets | |
| Wilson RF 01 Pro | 98 | 16×19 | Matte graphite, tan leather-look grip | Federer signature frame; no monogram modelled |
| Head Extreme MP (2026) | 100 | 16×19 | Lime green, black inner and outer panels on the upper hoop, black grip | The placeholder says "Yellow"; the photo is lime |
| Head Radical MP (2025) | 98 | 16×19 | Coral orange, redder throat and hoop sides, coral grip | |
| Head Gravity MP (2025) | 100 | 16×20 | Black with a teal lower hoop | |
| Head Boom MP (2026) | 100 | 16×19 | Light blue with navy shaft base and upper-hoop panels, navy grip | The placeholder says "Coral/Black (also Purple)"; the photo is blue, so the placeholder colour needs a second look |
| Prince Ripcord 100 280g (2025) | 100 | 16×19 | Light blue with royal-blue throat, upper hoop and grip | |
| Babolat Pure Aero 98 (2026) | 98 | 16×20 | Slate with two neon-yellow bands, same placement as the Pure Aero 100 | Bands copied from the Aero 100, not re-measured |

### Second batch (20 more, same day)

Same method, with two changes after review: paint is only placed where a photo shows it, and
parts that are not visible (bridge underside, inner edges, far side) follow the frame's visible
colouring instead of an accent. Mistakes found and fixed in the first batch: the Wilson Defyer
100 had a white sliver under the bridge (the photo's white band is on the throat arms), and the
Pure Aero 98 had a bridge line copied from the Aero 100 that no photo of the 98 shows.

Wilson Blade Pro 98 16×19 v10, Pro Staff 97 Classic, Ultra 99 Pro v5, Defyer 98 Pro; Head Speed
Pro 2026, Speed Tour 2026, Extreme Pro 2026, Boom Pro 2026, Prestige Pro, Prestige MP L,
Gravity Tour 2025, Radical Pro 2025; Babolat Pure Strike 100, Pure Strike 97, Pure Drive 98;
Prince Tour 98 2026, ATS Textreme Tour 98 Carbon, Ripstick 98, Warrior 100 285g, Phantom 100X 305g.

Caveats: the Speed Pro / Speed Tour paint copies the Speed MP's panel placement; the Strike 100
and 97 and the Drive 98 reuse the Strike 98 and Drive 100 band positions (same cosmetic family;
the photos agree but positions were not re-measured); the Prince Tour 98 orange lettering is a
block, not letters; the ATS Tour 98's grey graphics are approximated as grey zones. Candidates
skipped because the Tennis Warehouse photo looked like an older cosmetic than the record says
(VCORE 98, EZONE 98, EZONE Alpha, Percept 100 olive): they stay placeholders.

### Third batch (30 more, same day)

Seventeen new frames and thirteen new variants of existing frames (the wall is now 46 bays, 76
racquets in all). Method as in the second batch: a Tennis Warehouse photo was viewed for each new
frame and only visible paint was used. Variants reuse their family's paint and take specs from
the placeholder record.

New frames: Babolat Pure Aero Team (2023 gen), Pure Drive Tour (Gen10, 2021), Pure Strike Tour
(3rd gen, 2019), Evo Aero, Evo Drive, Evo Strike, Boost Drive; Head Extreme MP 2024, Boom Pro
2024, Graphene 360+ Extreme MP, Speed MP 2024, Squared; Prince Premier 110; Wilson Blade 98S
v9, Triad Three, Ultra Pro 16x19 v4; Solinco Prizm 115.

New variants: Clash 108, Pure Aero Team 2026, Pure Drive Team and Lite, VCORE 98 and 98 Tour,
EZONE 98 and 98 Tour, Percept 100, Phantom 100P and 107G, Ripcord 98 XS, Burn 100LS.

Caveats:
- The Boom Pro 2024 photo is mint and black; the placeholder said Black/Coral. Painted from the
  photo.
- Several Babolat cosmetics (Pure Aero Team, Pure Strike Tour, Evo Aero, Boost Drive) are
  asymmetric or camouflage-like; the model uses symmetric bands, so they are approximations.
- Years for the Evo, Boost, Squared, Premier and Triad frames are the retail listing's, not
  confirmed launch years.
- Skipped because the photo did not match the record: Head Graphene XT Radical MP (the photo is a
  2016 racquet), Hyper Hammer 5.3 (low-resolution dated photo). Not photographed: Triad Five.
- Variants were not checked against their own photos; the VCORE 98 and EZONE 98 Tennis Warehouse
  photos show older cosmetics than their records, so those two variants keep the flagship paint.

### Fourth batch (61 more, same day)

Eight new frames and 53 new variants (the wall is now 54 bays, 137 racquets in all). Method as
before: each new frame was painted from a viewed Tennis Warehouse photo, using only visible
paint; variants reuse their family's paint and take head size, pattern, beam, length and weight
from the placeholder record.

New frames: Wilson Triad Five; Babolat Evoke 105, Pure Aero 98 (2023 gen), Pure Strike VS,
Pure Drive VS, Pure Aero Tour (2019); Head PWR 110; Prince Warrior 107 275g.

Variants (by frame): Pure Drive 107; Pure Strike 98 18x20, 100 16x20, Team; Pure Drive Tour 100
(2020); Pure Aero Team 100 (2022); Boom Team, Elite; Extreme (2026) Team, Elite; Extreme 2024
Pro, Team; Gravity Pro, Team; Prestige Tour; Radical Elite, Team; Speed (2026) Elite, Team; Speed
Pro 2024; Tour 100 310g, 100P; Ripstick 100 280g; Ripcord 100 300g; Phantom 100X 18x20; ATS Tour
100 290; Blade 98 18x20, 100, 104; Clash 100L; Defyer 100L; Ultra 100L, 111, Team; RF 01, RF 01
Future; Ultra Pro 18x20; EZONE 105, 110, 115, 100 Plus, 98 Plus; Muse 98, 107; VCORE 100 Plus,
95, 98 Plus; Percept 97D; Blackout V2 285, 110, 300 XTD; Whiteout V2 305 18x20, 305 XTD.

Caveats:
- Variants were not checked against their own photos (the same cosmetic is assumed). Where a
  record names a different colour for a size (for example Pure Drive Plus, Pure Aero Plus,
  Warrior 100 300g) it was left out rather than painted by guess.
- Pure Strike VS and Pure Drive VS use older cosmetics than the 2024 frames; the photos match
  their records. Pure Strike VS has a leather-look grip in the photo.
- Babolat's asymmetric cosmetics are again approximated with symmetric bands (see the third
  batch). The Warrior 107's black shaft and bronze hoop are approximate: the photo is asymmetric.
- The silhouette test now compares only the thickest beam section when deciding whether two
  frames are visibly different; the check sees nothing else of the beam (Boom Elite vs Team
  differ only at the tip and shaft).
- Not added: colourways (for example the white ATS Tour 98) and anything whose Tennis Warehouse
  photo showed a different generation than its record.

### Fifth batch (70 more, same day; asked for 100)

Eight new frames and 62 variants (the wall is now 62 bays, 207 racquets in all). 70 is every
remaining placeholder that fits the library's rules; the other ~80 adult records are limited or
special editions (Rafa, Wimbledon, Spectra, Smiley, Hydrogen, US/Wimbledon flag cosmetics, pink
and white editions), records with no specs, older generations whose Tennis Warehouse photo does
not match the record, or racquets shorter than the 26 in the schema allows (juniors at 19 to 25
in). See the rule at the top: limited and event editions stay out.

New frames: Babolat Boost Aero, Boost Strike, Strike Evo; Prince O3 Legacy 110 (O-ports), Premier
105; Head Ti.S6; Yonex EZONE Ace; Wilson Hyper Hammer 5.3 Stretch OS. Each was painted from a
viewed photo; the Hyper Hammer photo is small and the gold trim is approximate.

Variants: Head Boom, Extreme (2026 and 2024), Gravity, Speed L/UL/XL sizes and PWR 115; Babolat
Pure Aero (Lite, Super Lite, 2018 Team/100/Plus), Pure Drive Gen10 (Team, Lite, 107, 110, Plus),
Pure Strike 2019 (100, 18x20, Team, 103) and Lite, Evo Aero Lite, Evo Drive (Lite, Tour, 115),
Evoke 102; Prince Tour 275g, Ripcord 265g, Phantom 290g; Wilson Blade (100L, 100UL, Pro 98
18x20, Pro 100), Defyer 100UL, Ultra 100UL; Yonex EZONE 100 SL and 100L, Muse 100L and 100SL,
VCORE 100L and 100D, Percept (97H, 97L, 100D, 100L, Game); Solinco Whiteout 290 and 305 XTD
18x20; and ten 26-inch juniors (Pure Aero, Pure Drive, Pure Strike, Boom, Speed, Radical,
Ripcord, Ripstick, Blade, EZONE). A junior reuses its adult frame's geometry, paint and beam where
the record gives no beam, at 26 in; real junior frames are lighter and thinner.

Skipped on purpose: Graphene XT Speed S (the photo is a tiny, older racquet), pink and white
cosmetics of existing frames, and records with `null` specs.

### Sixth batch (the rest of the placeholders that could be modelled)

Limited and event editions are now in (the rule above was lifted for this batch), and so are
juniors from 17 to 25 in: the schema now accepts racquets from 16 in and heads from 55 sq in.
This batch added 87 racquets: 11 new frames, 45 variants, 3 colourways and the white and
"Classic" cosmetics as variants with their own paint. The library is now 300 racquets on 79
frames (80 bays counting the colourways).

- Rafa: Pure Aero Rafa 2021 (Team, Lite, four junior sizes) and 2023 (Origin, Junior 26), Boost
  Aero Rafa. Gradients and the Rafa artwork are approximated with flat bands.
- Juniors: Babolat Aero, Carlitos, Drive, Pure Aero, Pure Drive (incl. Light Blue), Pure Strike,
  Rafa Nadal and B Fly (25, 23, 21, 19); Head Paw Patrol (the cartoon characters are not
  modelled), Instinct, Speed, Boom and Radical; Yonex Junior 17 to 26 and EZONE Junior; Prince
  Ripcord and Tour 25; Wilson Blade, Ultra and Clash 25. Junior beams are the adult frame's where
  the record gives none; real junior frames are thinner.
- Special editions: Prestige MP Limited, Beast Smiley (the smiley faces are not modelled),
  O3 Legacy 120 and 105 (gold), Burn Pink 105S, Warrior 100 300g, white ATS Tour 98/100/100P,
  Pro Staff 97L and Team Classic, Boost Drive White Coral, Boost Aero Raspberry Pink, Evo Drive
  White (colourways).
- Older frames: Evo Aero 2022 and Evo Drive 2021 (and their Lite), Head Radical XCeed.

Not modelled (54 placeholders remain):
- No head size or other spec in the record: Hydrogen Neon (3) and Skulls, Beast Ltd and Pink,
  Beast Smiley 265g, Warrior 100 265g, Cream and White Edition, Warrior Elite 25, Blackout V2 245
  and 265, Aero Junior 25, Boost Aero Rafa Lite, Pure Strike Japan, Rafa Nadal Junior 19, Drive
  Team Wimbledon, Gravity MP XL, VCORE 98L and VCORE 26 Junior.
- No usable photo (the Tennis Warehouse image was missing, or it shows a much older racquet than
  the record): Wimbledon editions (Boost, Boost Drive, Evo Drive 115, Pure Drive), Spectra (2),
  Evo Aero Pink (2), Graphene XT Radical/Speed (4), IG Speed juniors (2), Speed Junior 21 and 23,
  B Fly previous generation (4), Boost A, D, Aero, Drive 2021, Drive USA and Strike, Drive Junior
  23, Rafa Nadal Junior previous generation (2), Pure Drive 2018 (2), Ballfighter 17 and US Open 21.
