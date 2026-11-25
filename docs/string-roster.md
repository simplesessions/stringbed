# String roster

73 strings, 14 brands. One JSON file per string in `strings/<brand>/<id>.json`, checked by
`src/string-spec.ts`; `bun run generate` copies them into `assets/strings.json`. Researched
2026-11-24 from pages that were read and kept; merged the same day with the makers' own pages
winning. `tests/strings.test.ts` checks the set. Colours: every standard colour a read page names, up
to eight, with approximate hexes unless marked ✓.


**Gauge numbers** (16, 16L, 17…) are the ones a string's own cited pages or its maker's list print; where they do not, the one that brand uses for the same thickness; where the brand gives none (16 gauges), the site shows the usual number for that thickness marked `~`. Makers differ: 1.25 mm is 16L at Luxilon, Solinco and Yonex and 17 at Babolat, Head and Kirschbaum.

## How to read it

- **Maker first.** Where a maker page was read, its material, shape, gauges and colours win and its
  URL is the first source. Where it gives gauge letters only, or no colours, the retailer's stay.
  Dunlop and Prince print mm for one size of several, so theirs add to the retailer's gauges.
- **Shape** is there only if a page that was read states it. "Not stated" means no side count was
  found, not that the string is round. Three counts are placeholders for the model, not facts:
  Cyclone and Cyclone Tour (gear-shaped, 8) and Barb Wire (twisted, 0).
- **Finish** is sourced for three strings only: Dunlop Explosive Spin matte, Head Hawk gloss ("very
  shiny, reflective" in its review), Babolat RPM Power gloss (the maker's blog, of its brown). For the
  other 70 no page read states one, and satin is a placeholder.
- **Colours.** Every standard colour a read page names, in page order (sources in order), up to eight;
  the default is the first, or the one the maker leads with. Limited, special, shop-exclusive and
  discontinued editions are out. The hex is sampled from a photo where one was seen and is otherwise a
  plain approximation of the named colour. 151 colours in all. ✓ (`verified`) only where every listed
  colour was seen in a maker reel or coil photo and sampled (two of those photos are only 300 px wide:
  Hyper-G Round and Mach-10). Different shops' names for one colour count once.
- **Ratings** are our own, 1-5 against this set. No lab-database numbers are used.
- **Confidence** counts hands-on reviews, and pages of customer reviews, of the string itself, one per
  site: three or more hands-on reviews is high, two pages of either kind medium, fewer low. Shop and
  maker copy, one-line mentions and Tennis Overload (it says it has not playtested the strings and
  writes from specifications) do not count. 1 is high (Lynx Tour), 20 medium, 52 low.
- **Sources**: 72 of 73 (99%) have one that is not Tennis Warehouse; the exception is ALU Power
  Rough. The notes call Tennis Only and Typti Warehouse its sister shops: leaving those out too, 69
  of 73 (95%); Touch VS is among the four, since its only other source is a Tennis Only page.

## Strings by brand

### Babolat (6)

Maker: babolat.com answered; the RPM Blast and RPM Rough pages were read. Team, Power, Xcel and
Touch VS have retailer and reviewer sources only (Power also a Babolat blog photo).

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| RPM Blast | Octagonal | 1.20, 1.25, 1.30, 1.35 | Black ✓ | low | Maker: octagonal, Black; mm come from its variant codes. The photo is a very dark navy, so the hex leans blue. One page of customer reviews; the other is a spec page. |
| RPM Power | Round | 1.25, 1.30 | Electric Brown, Electric Blue | low | One spec page and the maker blog, which calls the string glossy. No review read. |
| RPM Rough | Octagonal | 1.25, 1.30, 1.35 | Yellow, Black, Red | low | Maker page is called RPM Rough; Tennis Only sells it as "RPM Blast Rough" and lists Black and Red. Only 1.25 is printed as mm on a page; 1.30 and 1.35 come from the maker's variant codes. The maker photo is yellow and prints no colour names. See contradictions. |
| RPM Team | Octagonal | 1.25, 1.30 | Black, Blue, Pink | medium | One guest review and retailer customers. Blue and pink named by the review, not seen. |
| Touch VS (natural gut) | not stated | 1.30 | Natural, Black | low | One retailer page with customer reviews; Black is named only as "Touch VS Blk" in a hybrid set on a Tennis Only category page (the file used to cite a Tennisnuts Gamma category page for it, dropped as a poor source). The pack shows no string, so both colours are approximations. |
| Xcel (multifilament) | Round | 1.25, 1.30 | Natural, Blue, Black, Red | low | The ordinary Xcel, from a spec page only. Tennis Only's Xcel Black is a special edition (firmer, more durable); its facts and photo are not used. |

### Dunlop (4)

Maker: us.dunlopsports.com answered; all four product pages were read. Each colour has its own page
and only one gauge prints mm, so the other gauges come from the Tennis Warehouse brand page.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Black Widow | Heptagonal | 1.21, 1.26, 1.31 | Black | medium | Seven sides from the maker and two reviews (one review also prints hexagonal). Pack 1.31, page text 1.33. The coil is barely visible in the pack photo. |
| Explosive Bite | Three-sided | 1.27, 1.32 | Black, Yellow | low | Three sides from the maker. No review read. |
| Explosive Spin | Hexagonal | 1.25, 1.30 | Black, Yellow | low | One review, which states the matte finish. Page says 16G while the pack prints 1.25 mm, 17g; 1.30 is a retailer size. |
| Iconic All (multifilament) | not stated | 1.25, 1.30 | Natural | low | No review read. The string is barely visible in the maker photo. |

### Gamma (4)

Maker: gammasports.com not requested. Retailer and brand-page facts only; no independent review of
Moto, TNT2 or Live Wire Professional.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| AMP Moto | Heptagonal | 1.24, 1.29 | Black, Lime | low | Seven edges from Tennis Only. Lime listed, not seen. No review read. |
| Live Wire (multifilament) | not stated | 1.27, 1.32 | Natural | low | One review, promotional in tone. |
| Live Wire Professional (multifilament) | not stated | 1.22, 1.27, 1.32 | Natural | low | One retailer page. |
| TNT2 (synthetic gut) | not stated | 1.17, 1.27, 1.32 | Natural, Black | low | Retailer copy only. The researched "Round" was on neither page read, removed. |

### Head (5)

Maker: head.com disallows robots. Retailer and reviewer sources only.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Hawk | Round | 1.20, 1.25, 1.30 | White, Grey, Black | low | One review, which calls it very shiny. Black is a later release it names, not seen. |
| Hawk Touch | Round | 1.15, 1.20, 1.25, 1.30 | Anthracite, Tequila Sunrise, Gold, Red | low | One review (Tennisnerd), which says it is about control more than spin, so the spin tag was dropped. Gold and Tequila Sunrise are Tennis Warehouse listings, not seen. |
| Lynx Tour | Hexagonal | 1.20, 1.25, 1.30 | Black, Grey, Orange, Champagne | high | Six sides from three reviews; four hands-on reviews read, the most of any string. |
| Sonic Pro | Round | 1.25, 1.30 | Black, White | medium | Round is stated by the Tennis This review. White named by the other review, not seen. Customer opinion on its arm-friendliness differs on the Tennis Only page (cited as a source, not counted toward confidence). |
| Velocity MLT (multifilament) | Round | 1.25, 1.30 | Black, Natural, Blue, Yellow, Pink | medium | Two reviews and customer reviews; a comment on one lists the same five colours. The reviewers differ on durability, so the rating is 3. |

### Kirschbaum (3)

Maker: both sites answered 429 on the first request. Retailer and reviewer sources only.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Max Power | not stated | 1.20, 1.25, 1.30 | Red, Silver | medium | One review (Tennisnerd). The Prostrung page rests on a lab figure, so it is not counted as a review and its lab scores were not used. |
| Pro Line II | not stated | 1.15, 1.20, 1.25, 1.30 | Black | low | Sold as Pro Line; Tennis Warehouse says it is the same string. Shop descriptions only. A Tennisnerd page the research listed does not mention it, removed. |
| Xplosive Speed | Pentagonal | 1.13, 1.20, 1.23, 1.28, 1.33 | Black | medium | Pentagonal from two reviews. Gauges are the union of two sources. Brighter colours exist but no page names them. |

### Luxilon (6)

Maker: luxilon.com answered but draws its pages by script, so it gave a title and a photo for one
string and no facts.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| 4G | Round | 1.25, 1.30 | Gold | medium | Review plus customer reviews. |
| ALU Power | Round | 1.25, 1.30 | Silver, Blue, Ocean Blue, Lime Green | medium | Four colours named by Tennis Companion; only silver seen. A maker page for the 128 RG set was read and holds no facts, so it is not a source: see contradictions. 1.15 and 1.20 were in a search summary only. |
| ALU Power Rough | not stated | 1.25 | Grey | low | Tennis Warehouse only, the one string with no other source. Textured, but its page states no shape. |
| ECO Power | Hexagonal | 1.25 | Teal | low | One review; the other page is a spec page. Both say six sides. Hex from a photo of a strung racquet. |
| Element | Round | 1.25, 1.30 | Bronze, Forest Green | low | Customer reviews; the other page is a spec page. Forest Green sold in some markets, not seen. |
| Natural Gut (natural gut) | not stated | 1.25, 1.30 | Natural | low | The researched "Round" is on neither page read (one says only "smooth"), removed. Colour is a straw default. |

### Prince (4)

Maker: princesports.eu answered for Premier Control only. The US maker site timed out on the one
request made.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Premier Control (multifilament) | Round | 1.25, 1.30 | Natural, Black | low | Maker: 1.30 and Natural; states no shape and shows no Black. Round and Black are from Tennis Overload and Tennis Only. One page of customer reviews. |
| Synthetic Gut Duraflex (synthetic gut) | Round | 1.20, 1.25, 1.30, 1.35 | White, Natural, Black, Gold, Green, Yellow, Blue, Red | medium | A shop lists twelve colours; eight are kept, in the order the pages name them. One review and one customer. |
| Tour XP | Round | 1.25, 1.30 | Black, Green, Red | low | Spec page and shop copy. Green and red named, not seen. |
| Vortex | Hexagonal | 1.20, 1.25, 1.30 | Black | low | No review read; ratings are tentative. Six sides from two shops. |

### Signum Pro (4)

Maker: signum-pro.com answered; all four product pages were read (material, gauges, one colour name
each, photos).

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Firestorm | not stated | 1.20, 1.25, 1.30 | Gold Metallic ✓ | medium | Colour corrected to the maker: Gold Metallic, not Gray. No shape stated. |
| Poly Plasma | not stated | 1.18, 1.23, 1.28, 1.33 | Pearl-orange ✓ | medium | Maker: Pearl-orange, four gauges. No shape stated. |
| Tornado | Heptagonal | 1.17, 1.23, 1.29 | Anthracite ✓ | medium | Maker: seven sides, axially twisted, Anthracite (two shops say black). Shop test and customer reviews on two sites. |
| X-Perience | not stated | 1.18, 1.24, 1.30 | Green ✓ | low | Maker says "shaped" with no side count. One page of customer reviews. |

### Solinco (15)

Maker: solinco.com answered; every current string was read. Its pages give gauge letters, not mm,
so mm come from retailers and reviewers. One colour per product page, sampled from the reel photo.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Barb Wire | Twisted | 1.20, 1.25, 1.30 | Black ✓ | low | Twisted, no side count stated anywhere. The zero sides in the file are a placeholder, not a claim that it is round. |
| Confidential | not stated | 1.15, 1.20, 1.25, 1.30 | Charcoal ✓ | medium | Colour corrected to the maker: Charcoal. Shape in dispute, see contradictions. |
| Confidential Soft | not stated | 1.15, 1.20, 1.25, 1.30 | Electric Pink ✓ | low | Colour from the maker. Tennis Only says five edges, Tennisnerd four sides, the maker no count: not stated. One full review. |
| Hyper-G | Square | 1.05, 1.10, 1.15, 1.20, 1.25, 1.30 | Hyper Green ✓ | medium | Square, four edges, from Tennis Only and Tennisnerd; the maker says only "shaped". The maker also lists a 15L, without mm. |
| Hyper-G Round | Round | 1.15, 1.20, 1.25, 1.30 | Hyper Green ✓ | low | Round from the maker. Retailer copy and a one-line mention only. |
| Hyper-G Soft | Square | 1.15, 1.20, 1.25, 1.30 | Hyper Green ✓ | medium | Square from Tennisnerd; the maker says only "shaped". |
| Mach-10 | Pentagonal | 1.15, 1.20, 1.25, 1.30 | Blue ✓ | low | Five edges from Tennis Only; the maker page states no shape, gauges or colour name. One full review. |
| Outlast | Round | 1.15, 1.20, 1.25, 1.30 | Red ✓ | low | Round and Red from the maker. One spec page, no review read. |
| Pro Stacked (synthetic gut) | not stated | 1.30 | Black, Red, Neon Green, Neon Yellow | low | Outside the design roster, current in the maker line. Gauge and colour names from the maker; 15L and 17 also sold. No colour photo read and no review, so hexes follow the names and ratings are tentative. |
| Revolution | Six-sided | 1.15, 1.20, 1.25, 1.30 | Blue ✓ | low | Six-sided from the maker. Hex darkened to the maker reel. |
| Tour Bite | Square | 1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35 | Silver ✓ | medium | Square from Tennisnerd; the maker says only "shaped". |
| Tour Bite Diamond Rough | not stated | 1.25, 1.30 | Silver ✓ | low | Textured; no side count stated. 1.25 from the maker reel label, 1.30 from the shop. The maker lists a 17, but no page prints its mm, so the researched 1.20 was removed. |
| Tour Bite Soft | Square | 1.20, 1.25 | Light Silver ✓ | low | Square from the maker. It sells four gauges (16, 16L, 17, 18); only two have mm on a page read. |
| Vanquish (multifilament) | Round | 1.20, 1.30, 1.35 | Natural ✓ | low | The maker's three gauges settle the dispute: 1.20, 1.30, 1.35 (Tennisnerd prints 1.25 and 1.30). One review; the other page is a spec page. |
| X-Natural (multifilament) | not stated | 1.20 | Black ✓ | low | Textured (Diamond Rough process); no shape stated. The maker sells three gauges; only 17 has mm (its reel prints 1.20). |

### Tecnifibre (5)

Maker: tecnifibre.com answered 429. Retailer and reviewer sources only.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Black Code | Pentagonal | 1.18, 1.24, 1.28, 1.32 | Black, Lime, Fire | low | Pentagonal from two sources. One spec page, no review read. |
| NRG2 (multifilament) | Round | 1.18, 1.24, 1.32 | Natural, Black | low | One spec page, no review read. Black not photographed. |
| Razor Code | Round | 1.20, 1.25, 1.30 | Carbon, Blue, White | low | One hybrid review; the other page is a spec page. |
| Triax (multifilament) | Round | 1.28, 1.33, 1.38 | Natural | medium | Two playing reviews. |
| X-One Biphase (multifilament) | Round | 1.18, 1.24, 1.30, 1.35 | Natural, Black, Red | low | Round is stated by Tennis Overload (the research file had none). One spec page, no review read. |

### Toroline (4)

Maker: toroline.com answered 429. Tennis Warehouse and Tennisnerd only.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Absolute | Hexagonal | 1.20 | Black | low | Six edges from Tennis Warehouse. One customer review. |
| Caviar | Hexagonal | 1.20, 1.24 | Neon Yellow | low | Only the 1.24 page was read; the 1.20 may have other colours. |
| O-Toro | Hexagonal | 1.23 | Black, Neon Green, Neon Pink, White | low | The shop-exclusive orange is a separate listing, not included. |
| Wasabi | Square | 1.23, 1.25 | Neon Green, Neon Pink, Pomegranate Red | medium | Square from both. 1.23 Tennis Warehouse, 1.25 Tennisnerd; Pomegranate Red is Tennisnerd only. |

### Volkl (4)

Maker: volkltennis.com answered 429. Tennis Warehouse and Tennisnuts only, and no independent
review, so all four are low.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| Cyclone | Gear-shaped | 1.10, 1.15, 1.20, 1.25, 1.30, 1.35 | Black, Anthracite, Graphite, Neon Blue, Fluo Orange, Yellow | low | Gear shape from both shops; no page counts the teeth, so 8 sides is a placeholder. Anthracite is named only on the 1.10 and 1.15 reels. One page of customer reviews and the shop's testers. |
| Cyclone Tour | Gear-shaped | 1.20, 1.25, 1.30 | Red, Anthracite | low | As Cyclone, and twisted (Tennis Warehouse). |
| V-Square | Square | 1.10, 1.20, 1.25, 1.30 | Black, Lava, Yellow | low | Four-sided from both shops. |
| V-Star | Round | 1.10, 1.15, 1.20, 1.25, 1.30 | Silver, Orange, White, Yellow | low | Tennis Warehouse's brand page says round co-poly. |

### Wilson (4)

Maker: wilson.com answered 429. Retailer and spec-page sources only.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| NXT (multifilament) | Round | 1.24, 1.30 | Natural, Black | low | Customer reviews; the other page is a spec page. The gauge is 1.24 as printed. Black named, not seen. |
| Natural Gut (natural gut) | Round | 1.25, 1.30 | Natural | low | One spec page and a pack photo; no review read. |
| Revolve | Round | 1.25, 1.30, 1.35 | Black, Orange, White | low | Customer reviews; the other page is a spec page. Orange and white named, not seen (one customer says the colours play differently). |
| Sensation (multifilament) | Round | 1.25, 1.30, 1.35 | Natural, Lime | low | Customer reviews; the other page is a spec page. Tennis Only labels the lime string Yellow too. |

### Yonex (5)

Maker: yonex.com and yonex.co.uk answered 429. Tennis Only and Tennisnerd only.

| String | Shape | Gauges (mm) | Colours | Confidence | Trust notes |
|---|---|---|---|---|---|
| PolyTour Drive | not stated | 1.25 | Yellow | low | One retailer page and a passing mention. "Sharp-edged" with no count. |
| PolyTour Pro | Round | 1.20, 1.25, 1.30 | Yellow, Graphite, Blue, Purple, Black | medium | Black is named by Tennis Only customers and a Tennis Warehouse listing, not seen. |
| PolyTour Rev | Octagonal | 1.20, 1.25 | Orange, Mint, Purple | medium | Eight sides from both sources. Purple and Mint from listings. |
| PolyTour Spin | Pentagonal | 1.25 | Cobalt, Black | low | Five sides from Tennis Only. The reel is sold as Blue, the set as Cobalt; taken as one colour. |
| Rexis Speed (multifilament) | not stated | 1.25, 1.30 | Natural | low | One review. The pack showed a near-white string. |

## Contradictions, and how each was settled

| String | What disagrees | Settled |
|---|---|---|
| Firestorm | Maker Gold Metallic; a shop says gray | Maker |
| Tornado | Maker Anthracite; a shop says black | Maker |
| Confidential | Maker Charcoal; research said Dark Silver | Maker |
| Confidential and Confidential Soft shape | Tennis Only: five edges (both). Tennisnerd: four-sided, Confidential with rounded edges (both). Maker: no count | Not stated, for both |
| Mach-10 shape | Tennis Only: five edges. Tennisnerd and maker: no count | Five |
| Hyper-G, Hyper-G Soft, Tour Bite | Maker says "shaped"; retailer or reviewer says square | Square |
| Revolution | Labelled hexagonal or six-sided; hexes differ | Six-sided and the darker maker blue |
| Vanquish gauges | 1.20/1.30/1.35 (Tennis Overload) or 1.25/1.30 (Tennisnerd) | First, matches the maker's 15L/16/17 |
| RPM Rough name | Maker RPM Rough; Tennis Only RPM Blast Rough (both octagonal, rough) | Same string, maker's name |
| RPM Rough colours | Maker photo yellow, two unnamed variants. Tennis Only: Black, Red | All three, yellow first; the second maker variant and whether Black and Red are current are unconfirmed |
| RPM Rough gauges | Shop page 1.25 only; the maker's variant codes give 1.25, 1.30, 1.35 | Maker, from the codes |
| ALU Power | The one maker page read, not a source, is "Alu Power 128 RG" with a blue photo; the sources say silver, 1.25/1.30 | Silver first, 1.25/1.30; RG looks like a different edition. Unresolved |
| Black Widow gauge | Maker pack 1.31; maker page text 1.33 | 1.31 |
| Black Widow shape | Maker and two reviews heptagonal; one review also prints hexagonal | Heptagonal |
| Explosive Spin | Maker page 16G; its pack prints 1.25 mm, 17g | 1.25 and the retailer's 1.30 |
| Xcel | Tennis Only's Black is a special edition, firmer than the ordinary string | Ordinary Xcel from the spec page; special edition left out |
| Premier Control | Maker states no shape and shows no Black; two other pages do | Kept, from those pages |
| X-Natural, Tour Bite Soft, Hyper-G gauges | Maker sells more letters than any page gives in mm | Only gauges with a printed mm |
| Xplosive Speed gauges | Tennis Warehouse and Perfect Tennis list different sets | The union; Perfect Tennis's 1.18 (probably the 1.20) left out |

## Approximate colours

54 strings are `verified: false`. Named but never seen, so plain approximations:

- ALU Power blue, ocean blue, lime green; Element forest green; RPM Team blue, pink; RPM Power electric
  blue; Touch VS both; all four Xcel; NXT black; Revolve
  orange, white; Duraflex natural, green, blue, red; Tour XP green, red; AMP Moto lime;
  Velocity blue, yellow, pink; Hawk black; Hawk Touch gold, Tequila Sunrise; Sonic Pro white; PolyTour
  Pro black; Cyclone anthracite, graphite, neon blue; Cyclone Tour red; V-Star white, yellow.
- From the name or a straw/black default: Luxilon Natural Gut, NRG2, Triax, Premier Control, Vortex,
  Live Wire, Live Wire Professional, TNT2, Iconic All, the three Kirschbaums, the four Torolines,
  V-Square, Pro Stacked; the natural and black of X-One Biphase and Velocity; Explosive Spin black.
- Seen, but judged by eye or sampled from a small pack or reel photo: the other Luxilon, Babolat, Wilson,
  Yonex and Tecnifibre colours; Head's; Duraflex white, gold, black, yellow; Dunlop's (the coil barely
  shows); Cyclone black, yellow, orange; Cyclone Tour anthracite; V-Star silver, orange. RPM Rough
  yellow is from the large maker photo, its Black and Red are not.

Even the ✓ hexes come from studio reel photos, so silver and dark strings carry some of the light.

## Sites that refused or failed

Left alone once they did; no workarounds.

- **429:** wilson.com, yonex.com, yonex.co.uk, tecnifibre.com, toroline.com, volkltennis.com,
  kirschbaum-strings.com, kirschbaumusa.com, diademsports.com, diademsports.eu, gammasports.com (met
  while the design was written, not asked again), solincosports.co.uk, merchantoftennis.com,
  racquetguys.com, racquetguys.ca, tennisexpress.com, tennispro.eu, tennis-point.com (404s first),
  kunstadt.com, thetennisstore.com.au. Some tripped on the tool's shared state, not on this research.
- **Robots disallow:** head.com, racquetdepot.com.
- **Unreachable or empty:** princetennis.com (timed out), thetennisbros.com and brianbollmantennis.com
  (DNS), stringforum.net (404), tennis-only.com (525), luxilon.com and the Prince Europe string list
  (drawn by script).
- **Cap:** Tennis Warehouse's 40 pages a day ran out, so several of its product pages were not used.

## Left out

- **Ashaway**: gauges, colour names and construction were read on the maker's table for nine strings,
  but no photo or review was. Next in line.
- **Diadem**: both maker sites refused. Next in line.
- **Solinco Heaven**: printed on every reel, but no such string exists. **Hyper-G Diamond Rough**: named
  only inside the Hyper-Con hybrid, no page of its own. **Hybrid packs** (Hyper-Con, Hyper-Mach BD,
  Tour Bite + Vanquish, Outlast + Pro Stacked, Hyper-G Hybrid): two strings, not one.
- **Editions**: Xcel Black special edition (Tennis Only), O-Toro orange (shop exclusive), the ALU Power
  128 RG set, Element Rough, Black and Soft (separate strings).
- **PolyTour Strike, TGV, NT Max Plus, Ocho, Asterisk**: not found under those names (design doc).
- Nothing in the design doc's roster was left out.
