# Racquet roster (v1)

Fifteen racquets, three per brand. This is the research input for the spec files in
`racquets/`.

**Read the trust column.** Values marked *recalled* came from the designing model's memory
and were not checked against a current source. Values marked *searched* were seen in a web
search on 2026-11-19. Nothing here was checked against manufacturer product pages or
photos. Task 2 of the plan does that and sets `verified: true` in each spec.

Beam widths are tip / mid / shaft in mm. All racquets are 27 in long unless noted.

## Yonex

Shared identity: the **isometric** head, visibly squared off across the top compared with
every other brand here. Get this right before anything else.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| EZONE 100 (2025 generation) | 100 | 16×19 | 23.8 / 26.5 / 22.5 | ellipse | Bright blue, darker blue/black accents | Thick, rounded power beam; widest at mid-head | Recalled; an "EZONE 100" 2026 listing was searched |
| VCORE 100 (2026 generation) | 100 | 16×19 | 25.3 / 25.3 / 22 | aero | Red family | Aero fins at the head tip; slim, flattened shaft | Generation *searched* ("8th gen" 2026 launch); numbers and colour recalled |
| Percept 97 | 97 | 16×19 | 21 / 21 / 21 | box | Midnight navy (was olive green) | Thin, constant box beam; smallest head of the Yonex three | Colour change *searched*; numbers recalled |

## Babolat

Shared identity: oval heads, a pronounced woofer-style grommet band, strong single-colour
schemes.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Pure Aero 100 (2026) | 100 | 16×19 | 23 / 26 / 23 | aero | Yellow with black | Flattened aero beam, the most distinctive cross-section in the set | 2026 model *searched*; numbers and colour recalled |
| Pure Drive 100 (2025) | 100 | 16×19 | 23 / 26 / 23 | ellipse | Blue | Thick elliptical beam; the archetypal "tweener" silhouette | Recalled |
| Pure Strike 98 16×19 (4th gen) | 98 | 16×19 | 21 / 23 / 21 | box (rounded corners) | White with orange-red accents | Squarer, thinner beam than the other two; white frame | Recalled |

## Wilson

Shared identity: oval heads, restrained matte paint, thin constant beams on the player
frames.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Blade 98 16×19 v10 | 98 | 16×19 | 21 / 21 / 21 | box | "Championship Green" with an infrared accent | Thin constant box beam; dark green | v10 and colour *searched*; numbers recalled |
| Clash 100 v3 | 100 | 16×19 | 24.5 / 24.5 / 24.5 | ellipse | Red and black family | Thick constant beam; long, flexible-looking throat | v3 exists (*searched*); numbers and colour recalled |
| Pro Staff 97 v14 | 97 | 16×19 | 21.5 / 21.5 / 21.5 | box | Copper-bronze with black | Classic box beam; leather-look grip; small head | v14 current (*searched*); numbers and colour recalled |

Wilson sells many limited cosmetics (US Open, Roland Garros and others). Use the standard
launch colourway for each.

## Solinco

Shared identity: the **tiger-camo** paint pattern. It is the reason the `camo` paint pattern
exists in the spec.

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Whiteout V2 305 | 98 | 16×19 | 21.7 / 21.7 / 21.7 | box | White with grey tiger camo | Thin box beam; white | Line and camo *searched*; beam recalled |
| Blackout V2 300 | 100 | 16×19 | 23 / 26 / 23 | ellipse | Black with tiger camo | Thick power beam; black | Line, head size and camo *searched*; beam recalled |
| Shadow | 100 | 16×19 | unknown | unknown | unknown | unknown | **Unconfirmed.** Recalled as a 2025 launch; the search found nothing |

**Shadow fallback:** if Solinco's site does not list a Shadow, replace it with the
Blackout V2 285 only if it differs visibly from the 300. Otherwise ship Solinco with two
racquets and say so in the README rather than invent a third.

## Prince

Shared identity: thin, tapering beams and, on some lines, **O-Ports** (large oval string
holes at 3, 9 and sometimes other positions on the hoop).

| Model | Head | Pattern | Beam | Cross-section | Colourway | Identity cues | Trust |
|---|---|---|---|---|---|---|---|
| Phantom 100X 18×20 | 100 | 18×20 | 20 / 18 / 16 | tapered-box | Matte black | Thinnest beam in the set, tapering toward the shaft; dense pattern | Model *searched*; numbers and colour recalled. A 2025 "O3 Phantom 100X" with O-Ports also exists (*searched*); pick whichever Prince shows as current |
| Tour 100 290g (2026) | 100 | 16×18 | 22 / 23 / 20 | box (rounded corners) | Unknown for 2026 | Open 16×18 pattern; mid-thickness beam | 2026 refresh *searched*; numbers recalled; colour unknown |
| Ripstick 100 | 100 | 16×18 | 24 / 26.5 / 24 | ellipse | Bright two-tone gradient | O-Ports; thick beam; the loudest paint in the set | Model *searched*; numbers and colour recalled |

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
