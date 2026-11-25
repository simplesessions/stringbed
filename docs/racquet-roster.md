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

**Generations.** A new generation is a new frame: its own spec file (a frame family), with its
own `generation` and `year`. Every generation of one line shares a `lineage` (default: brand and
line, kebab-cased, e.g. `babolat-pure-aero`; set it explicitly when two lines share a `line`
value, such as Pure Aero and Pure Aero Rafa, or the O3 Phantom and the Phantom). Variants inherit
their family's generation and never override it (a test enforces this): a junior or size from
another year belongs in that year's family. The gallery shows the newest generation of each
lineage on the wall, offers "Show older generations", and puts a generation picker on each
racquet page that jumps to the same size in the other generation where it exists.

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

## Added 2026-11-24: Dunlop and Tecnifibre

Two new brands, current and previous generation of each adult line only (no juniors). The library
is now 354 racquets in 86 frames. Specs come from Tennis Warehouse US pages and review pages,
tennisnerd and retailer snippets; colourways from the Tennis Warehouse product photo, face-on only.
Not yet checked against angled photos. Aspect ratios, bridge shapes, beam order and paint hexes
are judged by eye. Neither brand's own site was reachable, so unstrung weights are omitted for Dunlop
(TW lists strung only); Tecnifibre unstrung weights are the nominal figure in the model name.

- **Dunlop:** CX 200/400 (2027 and 2024), SX 300 (2025, 2022), FX 500 (2025, 2023; the FX 700 sits in the 2023 family as a variant), LX 800/1000 (2024). The 2027 CX year comes from retailer pre-sale listings. SX 300 2022 and FX 500 2023 have no TW product page; their specs come from review pages and search snippets.
- **Tecnifibre:** Fire (2026, the TF-X1 successor per TW and tennisnerd, kept as its own lineage), TFight (2025, ISO 2022), TF40 (2024, v1 2019), TF-X1 (V2 2024, V1 2022). The Fire 2026 year is inferred from pre-sale listings.
- **Also skipped:** Tecnifibre TFight 300 IG, TW-exclusive colours, Fire 255; Dunlop LX Team, CX/SX limited editions.
- Beam widths where sources disagree (TFight ISO 305, TF-X1 V1 300, TF-X1 V2) follow the notes in each spec's source list; the TF-X1 V1 300 beam (24 mm, TW) conflicts with tennisnerd (26 mm).

**Checked against tecnifibre.com (2026-11-24, same day).** The official product pages confirm the
unstrung weights, head sizes and patterns of Fire, TFight 2025 and the TF-40 V3, and the Fire beams (TF40 v1, TFight ISO
and both TF-X1 generations were not checked there). Corrections: TFight 300 beam is 23 / 23.5 / 23
(was 22.5 constant). Added: TFight Team (102 sq in, 285 g, beam 23 / 26 / 23 from one retailer page, as a
variant of the TFight 2025 frame, black upper hoop from the official photo). The "TF40 2024" frame is the V3
(same SKU as tecnifibre.com's TF-40 V3). Not added: the TF-40 AxT G2 (limited edition of 580). The new
Tempo line (Tour, Team, OS, L; no beam width published anywhere found). Beams of TFight 300S, 305S, 315S, 285,
270 and the TF-40 V3 are still unconfirmed by the official site, which lists none for them.

**Colour check (Dunlop and Tecnifibre, 2026-11-24).** All 56 models were rendered face-on, edge-on and from above next to their
product photos (Tennis Warehouse, us.dunlopsports.com, tecnifibre.com). Positions were read against a render with ruled paint zones; base
colours were sampled from photos, which vary with lighting. This replaces the earlier same-day notes.

- **Left and right differ** on every Dunlop and most Tecnifibre frames, so zones now take `side` ("left" is -X, seen from the front).
  Dunlop's template: long accent on the left (u 0.325 to 0.80), a short hex on the right (45 to 52 percent), and on most
  lines a dark or gold panel above both.
- **Dunlop:** FX 500 2025 and SX 300 2025 base colours, black collars, CX 400 Tour 2027 grip (black), butt caps follow white grips. SX 300
  LS/Lite and CX 2027 LS/OS no longer carry their own paint: the photos show the family's. The RSX300 review (March 2020) was removed
  from the SX 300 2022 sources: it covers the previous generation.
- **Tecnifibre:** Fire, TFight and Tempo throat bands are on the left arm only, TFight and TF40 v1 hoop stripes on the right only; TF40 v1 has
  a black right arm. TF-X1 V1 is white inside (the yellow inner face was wrong). TFight ISO has no hoop bands; its marks are on one arm.
- **Not modelled:** lettering, the TF40 V3 orange and white flecks, diagonal stripe edges, hexagon points, the SX 300 2025 stripe down
  the arm, the TF-X1 V1 yellow showing through the grommet strip, the LX 1000 double bridge. The FX Team 100 and LX Team 107 have two photos each.
- **Grommet strips:** on box and tapered-box beams with a `channel` (93 models, every brand with such frames) the strip faced inward and was invisible. Fixed
  in `trim.ts`; the 17 affected frames of other brands were looked at beside their photos (no photo found for the Pro Staff 97 v14).

**Dunlop checked against us.dunlopsports.com (2026-11-24).** The official product pages list unstrung weight,
pattern, beam, head size and balance, and have several photos. Added unstrung weights to every current-generation
Dunlop (CX 2027, FX 500 2025, SX 300 2025, LX 800). The earlier generations (CX 2024, SX 2022, FX 2023) are not on
the site, so they keep no unstrung weight. Added: FX 500 Super Lite and FX Team 100 (FX 500 2025 family; the site sells
them as 2026 products in the same cosmetic) and LX Team 107 (LX 2024 family, own light-blue/white/gold paint, approximated
symmetrically). Removed: LX 800 Tour (the site calls it a limited edition). The FX Team 100 page contradicts itself on weight
(285 g / 8.8 oz; 8.8 oz is 250 g); 285 g is used, unconfirmed. Not confirmed by the site: the "2027" CX year (the site gives no year), LX 1000 (not listed
there) and the beams of the CX frames (the site lists none).

**Tecnifibre Tempo (2026), added later 2026-11-24.** The new women's line (white with a teal fade over the upper hoop).
Modelled: Tempo Tour (102 sq in, 285 g) and Tempo Team (102 sq in, 270 g, 67.5 cm long). Weight, head, length and
pattern come from tecnifibre.com; the 23 / 23 / 21 mm beam comes from Sportano's spec tables for both (one retailer,
not Tecnifibre, and the same figure for both frames). Tempo OS (105 sq in) and Tempo L (102 sq in, 255 g) are left out:
no page found gives their beam. Colours from the official photos of the Tour and Team only; the Team's throat band is
pale mint where the Tour's is black.

**Handle shapes (2026-11-24).** `geometry.handle.elongationMm` is pallet width (string plane) minus depth. Values come from one
set of Talk Tennis measurements (podcast, 2021-12-07, 4 3/8 racquets; units and models not stated): Wilson and Babolat 32.4 x 28.5
(3.9), Yonex 32.8 x 29 (3.8), Dunlop 32 x 28.2 (3.8), Prince 31.2 x 28 (3.2), Head TK82S 31.3 x 28.5 (2.8), Head TK82 33.4 x 27.6
(5.8), Tecnifibre 33.1 x 27.9 (5.2). Each is applied to the whole brand, so differences between lines are not captured, and
juniors and budget frames use the adult figure unmeasured.

- **Head:** every frame uses TK82S except the Ti.S6. tennisnerd (Dec 2020) says all new Heads but the Pro Tour 2.0 do, and
  the current adult butt caps look alike in photos, Prestige included. Extreme Tennis lists its TK82 shell for Prestige, Radical,
  Boom and Extreme, but its TK82S page lists those ranges too (with Speed, Gravity, Instinct), so it shows what fits, not what ships. Ti.S6 as TK82 is inferred: the line predates TK82S (about 2009) and its cap is narrower.
- **Solinco:** left as a regular octagon; nobody has published a measurement. One forum post calls it "fairly similar to Wilsons".

Tecnifibre:

- **5.2 mm**: TF40, TFight, TFight ISO, TFight Team, Tempo, TF-X1 V1. The podcast's Babolat and Yonex values agree within 0.2 mm
  with a separate bare-handle thread (TT 561916), so its figures are read as bare mm. Tecnifibre said in 2019 that all its series share
  one handle shape (TT 653947); the TW TFight 315S, tennisnerd TF40 2024 and tennisrally TF40 reviews all call it rectangular.
  The end-on butt photos of these frames show the same cap (about 1.13-1.18 wide to deep; TF40 v1, Tempo and Team by eye).
- **3.5 mm, estimated:** Fire and TF-X1 V2, whose X-DAMP caps are visibly squarer (1.08-1.11). Nobody has published a
  measurement. Cap shape is a weak guide (Head's cap is 1.15 on a 1.10 pallet), and Tennis Express says the Fire grip was brought
  closer to the TFight's, so the true figure may be nearer 5.2.
- Not captured for any brand: grip size (all handles share one girth) and bevel edge sharpness.

**All brands checked against photos (2026-11-24).** Every base frame, plus each variant and colourway with its own paint (106 in the six
older brands; no photo for the Pro Staff 97 v14), was rendered beside its Tennis Warehouse photo. Band edges were measured, not read by
eye: the photo's hoop colour was sampled down both sides and each row converted to the model's frame coordinate. Low-contrast and thin
marks (Evo Strike, Defyer and Blade ticks, Classic stripes, throat and shaft zones) are by eye. Juniors and oversize heads line up less well.

- Zones can also take `bridge: false`, for bands that run past the throat junction without painting the bridge.
- **Wrong scheme before:** Pure Aero Junior 25 and 26 (2023) wore the 2018 yellow; Pure Aero 98 2023 wore the 2026 slate.
- **Left and right differ** on most Babolat, Head and Prince frames, several Yonex and a few Wilson; these were mirrored before.
- **Placement:** most Babolat bands sat too high, or were one wide band where there are two. Clash 100 v3 had a red band round the whole throat
  (it is a line under the bridge). Parts corrected: Pure Strike Evo, Evoke, Boom Pro and Clash Pro bumpers, Extreme 2026 and Ultra 100 v5 trim.
- Frames that are one colour carry a zone hidden under the bumper, because every spec must have one.
- **Not modelled:** lettering, slashes, camo and cartoon graphics, diagonal edges. Grip and base colours were looked at, not sampled, except where changed.
- Other variants inherit their base's paint and were not each compared with their own photo.

**Specs settled the same day.** TF-X1 V2 300 (24.5 / 25.4 / 25; tennisnerd and Extreme Tennis; Tecnifibre's page has no beam, Tradeinn's 24 / 25 / 24 was
not used) and TFight ISO 295 (23 constant, TW review; ProAm Tennis says 22.5) are back in. Dunlop Canada publishes the CX 2024, FX 500 Tour 2023 and
FX 700 specs: beams confirmed, unstrung weights added. CX 200 Tour 2024 (Canada lists only the 18x20) and OS (290 g against 10.4 oz) keep none. SX 300 2022
(tennisnuts), FX 500 2023 (Marcotte, TW review): confirmed; pages that were only search results were dropped from their sources. FX 500 Lite 2023 rests on TW alone.
LX 800: Dunlop US says 27 in, an older Canada page 27.5; 27 kept. Tempo OS and L have no published beam, so they are placeholders.
TF40 2024: TW's review page for it is dated February 2022 (the previous generation), so it was removed from the sources; the 22 mm beam is on TW's product
page (tennisnerd says 21.7). Tempo Tour: both Tecnifibre sites list 68.5 cm, but their range text says every Tempo is X-Short at 67.5; 27 in is kept.

## Weight, balance, swingweight and stiffness (2026-11-24)

Published numbers only, written to the base racquet's own `specs` with the page added to its `sources`. Nothing is estimated, converted
between strung and unstrung, or copied down to variants (a variant with its own `specs` does not inherit them, so no variant has a balance or a stiffness).

**Coverage.** Unstrung weight plus balance: 10 racquets, all profiled base racquets, so 10 of 37 (Babolat 6 of 7, Dunlop 4 of 4, no other brand)
and 10 of 358 overall. Stiffness (RA): the 6 Babolat. Strung weight, strung balance and swingweight: none. Unstrung weight alone: 136 of 358 racquets, 26 of
the 37. The other 27 of the 37 have no balance: on the Build page they show only what you add, unless you enter your own weight and balance.

| Racquet | Unstrung weight | Balance | RA |
|---|---|---|---|
| Babolat Boost Aero 2026 | 260 g | 340 mm | 68 |
| Babolat Evo Aero 2026 | 275 g | 320 mm | 64 |
| Babolat Evo Drive 2025 | 270 g | 325 mm | 70 |
| Babolat Evo Strike Gen2 | 290 g | 320 mm | 70 |
| Babolat Pure Drive 100 | 300 g | 320 mm | 72 |
| Babolat Pure Strike 98 | 305 g | 320 mm | 68 |
| Dunlop CX 200 16x19 2027 | 305 g | 315 mm | |
| Dunlop FX 500 2025 | 300 g | 320 mm | |
| Dunlop LX 800 2024 | 255 g | 355 mm | |
| Dunlop SX 300 2025 | 300 g | 320 mm | |

**Where from.** The makers' own pages. Babolat labels weight and balance "(unstrung)" and prints "Stiffness (RA)"; Evo Aero and Evo Drive print it with
and without AHT, and the figure without is used. Its swing weight is not labelled strung or unstrung, so it was left out. Dunlop US labels the weight
"(Unstrung)" and prints no stiffness; its balance has no label, but stands beside the unstrung weight on a frame that ships unstrung, so it is taken as unstrung.
No existing unstrung weight differed from the maker's; four racquets had none (Boost Aero, Evo Aero, Evo Drive, Evo Strike) and took it.
FX 500 (`dunlop-fx-500-2025`): the maker page is the plain FX 500 at 300 g, the same as our base racquet, not the Lite.

**Read and not published.** A retailer's table (Tennis Only, tennisonly.com.au: strung weight, balance, swingweight and stiffness) was read for 21 of the 37
base racquets and deliberately not published: its terms (https://www.tennisonly.com.au/termsofuse.html, read 2026-11-24) forbid reproducing its content.
None of its racquet numbers are in the specs, and it is no longer among their sources.

**Not reached.** Sites that refused or were left alone: Racquet Guys (.com and .ca), Tennis Express, Merchant of Tennis, Tennis Point, Tecnifibre.com,
Wilson.com and Yonex.com (HTTP 429); tennis-only.com returned 525; head.com disallows its product pages for robots. Tennis Warehouse was not used for these
numbers. Babolat lists only Gen 9 of the Pure Aero 100, so it has none.
