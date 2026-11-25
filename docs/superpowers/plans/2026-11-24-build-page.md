# Build My Racquet Implementation Plan (2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page, opened from any racquet, where you string, tension, weight and dress it, watch weight, balance and play change live, hear it, and send the result as a link.

**Architecture:** Three pure layers under one page: `src/restring.ts` and `src/tape.ts` change a loaded model, `src/mass.ts` does the arithmetic, `src/play.ts` makes the estimate. A `Build` value is the only state; the address is its text form. The racquet page's viewer draws it.

**Tech Stack:** Bun, TypeScript, zod, three.js, Web Audio, Vite. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-24-strings-and-build-design.md` (formulas, coefficient table, address keys, traps, research rules). **Needs** plan 1 (`2026-11-24-strings.md`) merged: `StringSpec`, `loadStrings`, `parseHash`/`buildRoute`, `ratingsView`, `crossSection`.

## Global Constraints

- Every GLB under `assets/` stays byte-identical. `catalog.json` changes only by the optional fields of Task 1.
- Part names and the coordinate convention do not change. `src/core` imports nothing from `src/styles`, `src/export` or `site`.
- `src/restring.ts`, `tape.ts`, `mass.ts`, `play.ts` are browser-safe: no zod at run time, no Node, no glTF-Transform.
- A published number is never invented. Missing weight or balance: show only what was added. Derived numbers say "about".
- Anything about play is labelled: "Our estimate from the ratings and your settings. Not a measurement."
- Restrung bed at most 1,500 triangles; tape at most 24 pieces and 4,000 triangles.
- At most two WebGL contexts. 375 px up; every control works by keyboard, tape included; reduced motion; without WebGL everything but the picture works.
- Sounds at most 0.16, no pitch slides, off by default. Download stays stock.
- The design doc's Research rules bind every request. British spelling.

## Review Focus

1. **A damaged or old link** keeps every part it can read and opens; it never throws or blanks. (Task 5)
2. **Dragging hard for 30 seconds** neither floods history nor leaks geometry nor queues sounds. (Tasks 6, 8)
3. **A racquet with no weight, no balance and no ratings** (there are many) still gives a useful, honest page. (Tasks 3, 4)
4. **Tape on odd frames:** isometric, O-Port, junior, extended. It lies on the frame, never in mid-air. (Task 2)
5. **Black strings** are dark in Pixel, Line and Halftone. (Task 6)

## File Structure

```
src/core/spec.ts          specs gain balanceMm, strungWeightG, strungBalanceMm, swingweight, stiffnessRa (all optional)
src/styles/finish.ts      ROUGHNESS, moved out of realistic.ts so restring can share it
src/restring.ts           bedLines, strandGeometry, restring
src/tape.ts               placeTape, tapeGeometry
src/mass.ts               point masses, weight, balance, swingweight, pitch
src/play.ts               the estimate: shifts, reasons, sentences
site/src/build-state.ts   Build value, address codec, defaults (pure)
site/src/build-page.ts    the page's DOM
site/src/build-stage.ts   placing tape on the model with pointer or keys
site/src/sound.ts         pluck, ratchet, weave, peel, press, wrap, thump, stamp
```

---

### Task 1: Weight, balance, swingweight, stiffness as data

**Files:**
- Modify: `src/core/spec.ts`, `racquets/**/*.json`, `docs/racquet-roster.md`, `site/src/main.ts` (`specRows`)
- Test: `tests/core/spec.test.ts`, `tests/racquets.test.ts`

**Interfaces:**
- Produces, optional in `RacquetSpec['specs']` (they reach `catalog.json` unchanged): `balanceMm` (unstrung, 250-420), `strungWeightG` (150-420), `strungBalanceMm` (250-420), `swingweight` (strung, kg·cm², 180-420), `stiffnessRa` (40-85).

- [ ] **Step 1: Failing tests:** each field parses in range and is rejected outside it; a variant that replaces `specs` does not inherit the base's numbers; `strungWeightG`, where both are given, is 8-25 g above `unstrungWeightG`.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Add the fields; show those present in `specRows` with "unstrung" or "strung" beside them.
- [ ] **Step 4: Research**, under the Research rules and **split by site**: newest generation's adult flagships first, then their sizes, then older generations, then juniors. Never convert strung to unstrung in the data. Record the URL in `sources`. Two sites that disagree by more than 5 g or 5 mm: the maker's wins, note it in the roster. A racquet with nothing found stays without.
- [ ] **Step 5:** Write coverage per brand in the roster, and which sites refused. Aim: weight and balance (either kind) for all 37 profiled frames' base racquets; report the number reached rather than padding it.
- [ ] **Step 6:** Run `bun run generate && bun test && git status --short assets`. Expected: PASS; only `assets/catalog.json` modified. Commit per brand: `data: <brand> weight and balance`.

### Task 2: Restringing and tape on a loaded model

**Files:**
- Create: `src/restring.ts`, `src/tape.ts`, `src/styles/finish.ts`
- Modify: `src/styles/realistic.ts`, `src/index.ts`
- Test: `tests/restring.test.ts`, `tests/tape.test.ts`

**Interfaces:**
- Produces (all exported by `src/index.ts`):

```ts
// restring.ts
export interface Strand { color: HexColor; finish: Finish; gaugeMm: number; sides: number }  // sides 0 = round
export interface Line { at: number; from: number; to: number }   // metres; mains: at = x, from/to = y; crosses: at = y, from/to = x
export interface Bed { lines: Line[]; z: number }
export interface Beds { mains: Bed; crosses: Bed }
export function bedLines(root: Object3D): Beds | null;            // null when either part is missing
export function strandGeometry(bed: Bed, axis: 'mains' | 'crosses', strand: Strand): BufferGeometry;
export function restring(root: Object3D, mains: Strand, crosses?: Strand): (() => void) | null; // in place; returns an undo, safe to call twice
// tape.ts
export type TapeZone = 'h' | 'l' | 'r';
export interface TapePiece { zone: TapeZone; at: number; mirrored: boolean; lengthMm: number; layers: number } // at: h degrees 0-359 clockwise from 12; l/r mm from the butt
export interface PlacedTape { piece: TapePiece; path: Vector3[]; normals: Vector3[]; centroid: Vector3 }      // racquet space, one per side
export function placeTape(root: Object3D, beds: Beds, piece: TapePiece): PlacedTape[];                        // 1, or 2 when mirrored; [] when it cannot lie on the frame
export function tapeAt(root: Object3D, beds: Beds, hit: Vector3): Pick<TapePiece, 'zone' | 'at'>;             // what a click there means
export function tapeGeometry(t: PlacedTape): BufferGeometry;                                                  // a 6.35 mm wide ribbon 0.2 mm proud per layer
```

- `src/styles/finish.ts`: `ROUGHNESS: Record<Finish, number>`, today's values.

**`bedLines`** (checked on all 364 files): per string mesh, `updateMatrix()`, apply `mesh.matrix` to each position read with `fromBufferAttribute`, sort on the axis, start a new string where the gap exceeds 2 mm; `at` is the group's midpoint, `from`/`to` the other coordinate's extent. Always read original geometry.

**`restring`:** new geometry, a **new** `MeshStandardMaterial`, transform reset to identity (the originals carry the quantisation scale). Names and shadow flags stay. Undo restores the originals and disposes only its own: originals belong to a shared cache. Round is an 8-sided tube with radial normals; otherwise flat faces, one towards +Z; circumscribed diameter = gauge.

**`placeTape`:** raycast against copies of the parts with double-sided materials. `h`: from the bed's centre outward at z = ±5 mm, stepping along the arc until `lengthMm` is covered (the hoop half of this is checked: 25,776 rays, no misses). `l`/`r`: from x = ±0.2 m inward at height y against `frame`, `collar`, `grip` (not yet checked; its test is below). Mirroring: `h` a → 360 − a, `l` ↔ `r`; a piece at 0° or 180° is its own mirror and comes back once.

- [ ] **Step 1: Write the failing tests**, on real files through `GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync` (runs under Bun):

```ts
test('every published file gives back its string pattern', ...);        // all 364: counts equal specs.stringPattern
test('lines match the builder to 0.05 mm', ...);                        // babolat-pure-aero-100 against buildMains/buildCrosses
test('restrung meshes are gauge thick, in racquet space, under budget', async () => {
  const root = await load('realistic/babolat-pure-aero-100.glb');
  const before = new Box3().setFromObject(root.getObjectByName('strings_mains')!);
  restring(root, gut135, poly115);
  const mains = root.getObjectByName('strings_mains') as Mesh;
  const after = new Box3().setFromObject(mains);
  expect(after.max.z - after.min.z).toBeCloseTo(0.00135, 5);
  expect(after.min.y).toBeCloseTo(before.min.y, 4); expect(after.max.y).toBeCloseTo(before.max.y, 4);
  expect(mains.scale.x).toBe(1);
  expect(tris(root, 'strings_mains') + tris(root, 'strings_crosses')).toBeLessThanOrEqual(1500);
});
test('the source a clone came from keeps its geometry, material and colour', ...);
test('undo restores everything, disposes only its own, and is a no-op twice', ...);
test('a model without string parts gives null', ...);
test('faces point outward, round and six-sided', ...);
test.each(['babolat-pure-aero-100', 'yonex-ezone-100', aPrinceOPort, aJunior25])('%s: hoop tape at 12, 3, 5 and 9 o’clock lies on the frame', ...); // every path point within 1 mm of the frame mesh; path length within 2 mm of lengthMm
test('every racquet takes side tape at 60 and 150 mm on both sides', ...);  // all 358: placeTape returns 1 piece, |x| between 8 and 60 mm
test('mirrored 3 o’clock is one piece each side, equal and opposite in x', ...);
test('mirrored 12 o’clock is one piece', ...);
test('tapeAt of a placed piece’s middle gives back its zone and place', ...);  // within 2 degrees / 2 mm
test('an impossible piece gives [] and does not throw', ...);               // r at 900 mm
```

- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test && bun run typecheck && bun run generate --check`. Expected: PASS, up to date. Commit: `feat: restring and tape a loaded model`.

### Task 3: The arithmetic

**Files:**
- Create: `src/mass.ts`
- Modify: `src/index.ts`
- Test: `tests/mass.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PointMass { g: number; x: number; y: number; label: string }  // metres
export const DENSITY: Record<StringMaterial, number>;                           // kg/m³
export const WRAP_M = 0.034; export const TAPE_G_PER_INCH = 0.25; export const OVERGRIP_G: number; export const DAMPENER_G: number;
export function stringMasses(beds: Beds, mains: { material: StringMaterial; gaugeMm: number }, crosses: typeof mains): PointMass[]; // one per line
export function tapeMasses(placed: PlacedTape[]): PointMass[];
export interface Baseline { g: number; balanceMm: number; from: 'yours' | 'published' | 'derived' }
export function baseline(specs: RacquetSpec['specs'], beds: Beds, yours?: { g?: number; balanceMm?: number }): Baseline | null; // unstrung
export interface Readout {
  weightG: number | null; balanceMm: number | null; pointsHeadLight: number | null; about: boolean;
  swingweight: number | null;                                     // only when specs.swingweight is published; always about
  added: { g: number; swingweight: number; twist: number };       // everything put on, strings included
  addedPlay: { swingweight: number; twist: number };              // against a 1.25 mm polyester bed and nothing else: what Task 4 uses
}
export function readout(specs: RacquetSpec['specs'], beds: Beds, base: Baseline | null, parts: PointMass[]): Readout;
export function pitchHz(beds: Beds, mains: { material: StringMaterial; gaugeMm: number }, tensionLb: number): number; // the main nearest x = 0
```

- `yours` beats `published` (`unstrungWeightG` and `balanceMm`), which beats `derived` (strung figures minus a 1.30 mm synthetic gut bed). Both numbers must come from one source kind, else null; `weightG` alone may still show when only a weight is known. `swingweight` = published strung figure minus a 1.30 mm synthetic gut bed plus the parts.

- [ ] **Step 1: Write the failing tests**

```ts
test('4 g at the tip of a 27 in racquet is 13.65 kg cm²', ...);            // x 0, y 0.6858
test('2 g either side at 0.13 m adds 0.676 twist', ...);
test('300 g at 320 mm plus 15.8 g at 513 mm is 315.8 g at 329.7 mm, 4.2 points head light', ...);
test('a Pure Aero bed of 1.25 polyester is 15 to 17 g centred 505 to 520 mm up, and nylon is lighter', ...);
test('pitch rises with tension, falls with gauge, and 1.25 polyester at 52 lb is 540 to 600 Hz on a Pure Aero', ...);
test('no weight and no balance: nulls, but added is still right', ...);
test('derived is marked about; yours beats published; a weight without a balance gives weight only', ...);
test('the reference build has zero addedPlay', ...);
test('12 o’clock tape moves balance up, handle tape moves it down, both raise weight', ...);
```

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Source `DENSITY`, `TAPE_G_PER_INCH`, `OVERGRIP_G`, `DAMPENER_G` under the Research rules and cite each in a comment; a value with no source found is the design doc's, marked "unsourced estimate" in the comment and in the UI's "how we work this out". Implement.
- [ ] **Step 4:** Run `bun test && bun run typecheck`. Expected: PASS. Commit: `feat: weight, balance and swingweight`.

### Task 4: The estimate

**Files:**
- Create: `src/play.ts`
- Test: `tests/play.test.ts`

**Interfaces:**
- Produces:

```ts
export const PLAY_KEYS = ['power', 'spin', 'control', 'comfort', 'stability', 'maneuverability', 'feel', 'durability'] as const;
export type PlayKey = (typeof PLAY_KEYS)[number];
export interface PlayInput {
  racquet: { name: string; ratings: Partial<Record<PlayKey, number>> | null; pattern: [number, number]; junior: boolean };
  mains: { string: StringSpec; gaugeMm: number; tensionLb: number }; crosses: PlayInput['mains'];
  addedPlay: Readout['addedPlay'];
}
export interface PlayRow { key: PlayKey; base: number | null; value: number | null; shift: number; reasons: Array<{ text: string; shift: number }> }
export function estimate(input: PlayInput): PlayRow[];   // PLAY_KEYS order; value clamped 1..5; reasons with |shift| >= 0.1, biggest first, at most 3
export function verdict(input: PlayInput): string[];     // 1-3 sentences
```

- Coefficients are the design doc's table, in one exported `SHIFT` constant. `base` is the racquet profile's; durability's is the strings' own (0.65/0.35).
- `verdict` takes the first three that apply, in this order: junior with any polyester ("Full polyester is a hard ride for a young arm; a multifilament is the kinder choice."); polyester both ways above 56 lb (stiff and unforgiving, try lower); spin up by 0.4 or more on 16×18 or more open (grabs the ball); 18×20 with a spin string (the dense pattern holds the spin back); hybrid of gut and polyester (which job each does); swingweight up 8 or more (steadier, slower to swing); swingweight down 3 or more (quicker, less plough-through); the biggest rise and biggest fall by name. Nothing applies: "Close to how the <name> plays as it comes."

- [ ] **Step 1: Write the failing tests**

```ts
test('the reference build shifts nothing', ...);
test.each([['tensionLb', 'power', -1], ['tensionLb', 'comfort', -1], ['tensionLb', 'control', 1], ['gaugeMm', 'durability', 1], ['gaugeMm', 'spin', -1]] as const)('more %s moves %s the right way', ...);
test('tension stops counting beyond three steps', ...);            // 67 lb and 80 lb equal
test('values stay within 1 and 5 for every racquet profile and every string at 30 and 75 lb', ...); // full sweep, finite, no NaN
test('mains outweigh crosses', ...);                               // gut/poly differs from poly/gut, in the mains’ direction
test('no profile: base and value null, shifts still there', ...);
test('reasons name their cause and add up', ...);                  // when none is below the cut, they sum to shift
test('verdict is one to three sentences for every racquet with every string', ...);
test('junior polyester is cautioned; junior multifilament is not', ...);
```

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run `bun test`. Expected: PASS. Commit: `feat: play estimate`.

### Task 5: The build and its address

**Files:**
- Create: `site/src/build-state.ts`
- Test: `tests/site/build-state.test.ts`

**Interfaces:**
- Produces:

```ts
export interface StringChoice { id: string; colour: string; gaugeMm: number }
export interface Build {
  mains: StringChoice | null; crosses: StringChoice | null;          // mains null: stock strings; crosses null: same as mains
  tensionLb: number; crossTensionLb: number | null;                  // 30-75 in halves; default 52; null: same
  tape: TapePiece[];                                                 // at most 24; length 10-300 mm; layers 1-4
  overgrip: string | null; dampener: string | null;                  // ids from COLOURS
  yours: { g?: number; balanceMm?: number };                         // 150-420, 200-450
}
export const COLOURS: Array<{ id: string; name: string; hex: HexColor }>;   // white, black, red, blue, yellow, green, pink, orange
export function emptyBuild(): Build;
export function formatBuild(b: Build): string;                       // '' for emptyBuild(); else 'v=1&…' in the spec's key order, defaults left out
export function parseBuild(query: string, strings: StringSpec[] | null): { build: Build; dropped: string[] }; // strings null: choices kept unchecked
export function chooseString(s: StringSpec, colour?: string): StringChoice; // gauge nearest 1.25, thinner on a tie
```

- [ ] **Step 1: Write the failing tests**

```ts
test('the empty build is an empty query and back', ...);
test('a full build survives the address exactly', ...);                 // hybrid, two tensions, 5 pieces in all zones, grip, dampener, yours
test('the spec’s own example parses', () => {
  const { build, dropped } = parseBuild('v=1&s=luxilon-alu-power.silver.125~babolat-touch-vs.natural.130&t=52~50&l=h90m.40.2~l150m.60.1&g=white&d=red&w=305&b=320', strings);
  expect(dropped).toEqual([]); expect(build.tape[0]).toEqual({ zone: 'h', at: 90, mirrored: true, lengthMm: 40, layers: 2 }); expect(build.crossTensionLb).toBe(50);
});
test('out-of-range numbers are brought into range; unreadable parts are dropped and named; the rest is kept', ...);
test('an unknown string, colour or gauge: stock / first colour / nearest gauge, the string named in dropped', ...);
test('junk never throws', () => { for (const q of ['', '&&&', 's=', 's=~', 't=NaN', 'l=h', 'l=' + 'h1.10.1~'.repeat(999), '%E0%A4%A', 'x'.repeat(9999)]) parseBuild(q, strings); });
test('format then parse is stable for 500 random valid builds', ...);   // seeded generator
```

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run `bun test && bun run typecheck`. Expected: PASS. Commit: `feat: builds and their address`.

### Task 6: The viewer wears the build

**Files:**
- Modify: `site/src/viewer.ts`, `site/src/look-passes.ts`

**Interfaces:**
- Produces on `Viewer`:

```ts
dress(d: { strings: { mains: Strand; crosses: Strand } | null; tape: TapePiece[]; overgrip: HexColor | null; dampener: HexColor | null; balanceMm: number | null } | null): void; // kept across show(); null is stock
get model3d(): { root: Object3D; beds: Beds } | null;
pick(clientX: number, clientY: number): Vector3 | null;   // the point on the frame, collar or grip under the pointer, in racquet space
```

- [ ] **Step 1:** `dress` changes only what differs from the last call, and undoes everything before a model leaves. Overgrip: a fresh material on `grip`. Dampener: a rounded block between the two centre mains just above the lowest cross, sized as `buildDampener`'s constants (export them). Tape: meshes named `tape`, matte lead grey. Balance: a thin marker at that height, hidden when null and not drawn into Line/Pixel/Halftone string passes. Restring before the model enters the scene, so stock strings never flash. Frame with the undressed model's box, so tape never re-frames the view.
- [ ] **Step 2:** Pixel look: draw the string pass with `flatFor` materials (as `renderLine` does) and replace `c.rgb = c.rgb / max(...) * 0.85` with `c.rgb *= 0.85`.
- [ ] **Step 3:** Run `bun run typecheck && bun test`. Expected: PASS.
- [ ] **Step 4: Check in the browser** (scratch calls, not committed): black, white, gut and a black/yellow hybrid, tape in every zone, in all four looks, on an isometric, an O-Port and a 25 in junior. Stock white in Pixel is not noticeably different from `main`. 300 random `dress` calls leave `renderer.info.memory.geometries` where it started.
- [ ] **Step 5:** Commit: `feat: the viewer wears a build; dark strings stay dark in the pixel look`.

### Task 7: Sounds

**Files:**
- Modify: `site/src/sound.ts`
- Test: `tests/site/sound.test.ts`

**Interfaces:**
- Produces: `play(name)` for `ratchet`, `weave`, `peel`, `press`, `wrap`, `thump`, `stamp` (data in `SOUNDS`; `weave`, `peel` and `wrap` are short timed runs of one knock); `pluck(hz: number, opts: { muted: boolean }): void` (partials at 1, 2 and 3 times `hz`, decay constants 0.28, 0.16, 0.09 s, or 0.04, 0.02, 0.01 muted).

- [ ] **Step 1: Failing tests** against the data: every level and the pluck's total at most 0.16; every run at most 400 ms; `ratchet` and `pluck` share a limiter that lets one through per 60 ms; nothing plays when sound is off.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement within the file's rules (no slides, through the same low-pass bus; raise its cut-off only if the pluck needs it, and check the old sounds by ear).
- [ ] **Step 4:** Listen to each on speakers and headphones; the owner asked for cool and, earlier, for quiet. Commit: `feat: build sounds`.

### Task 8: The page

**Files:**
- Create: `site/src/build-page.ts`, `site/src/build-stage.ts`
- Modify: `site/src/main.ts`, `site/src/strings-page.ts`, `site/src/styles.css`, `DESIGN.md`

**Interfaces:**
- Consumes everything above, and plan 1's `ratingsView`, `crossSection`, `searchAll`, `buildRoute`.

Design with the Impeccable skill inside `DESIGN.md`'s system (launcher still off unless cleared). It must do:

- **Ways in:** "Build this racquet" on every racquet page with a model, carrying its colourway; "Put it on a racquet" on every string page, which opens search limited to racquets and lands with that string in. "Change racquet" keeps the whole build. Back to the racquet page.
- **Strings:** mains, and crosses the same or different, from the string list (filter by material, find by name), each with colour, gauge and cross-section; stock strings is a choice. Link to the string's page.
- **Tension:** 30-75 lb in halves, lb/kg switch (remembered; the address is always lb), crosses the same or different.
- **Lead:** an Add tape mode where the frame shows where a piece would go; click to stick, drag to move, presets (12, 3 and 9, 10 and 2, throat, handle), and a list where each piece has place, length, layers, both sides, remove. The list alone can do everything, by keyboard.
- **Grip and dampener:** colours from `COLOURS`, or none.
- **Readout, always in view:** weight, balance with points, swingweight, twist added, each with what changed; a balance beam that tips; "Use my own measurements". Missing numbers read "Not published" beside the change. "How we work this out" lists the formulas and constants.
- **What it does:** `verdict`, then `estimate` as the racquet's ratings with the new mark and reasons, then the estimate line from Global Constraints. No profile: arrows and "This racquet has no ratings here yet, so this shows the change only."
- **About this racquet:** specs and write-up as on its page. Download stays stock and says so.
- **Link:** every change rewrites the address with `replaceState`, at most once per 400 ms and once more at rest (Trap 7). Copy link. Start over. A changed address (paste, Back) redraws the page. `dropped` becomes one notice: "Some of this link could not be read: <names>. The rest is here."
- **Sound:** a labelled switch here too. Pluck after a string or tension change settles and on tapping the bed. Sound never plays from an incoming link.
- The first string pick moves in on the head; tape mode shows the whole racquet. Changes are announced: "Weight 329 grams, balance 331 millimetres, 4 points head light."
- Without WebGL: the model file is still loaded for the arithmetic; the picture is the silhouette with a note.

- [ ] **Step 1:** `build-page.ts` state loop with bare controls: address ↔ `Build` ↔ `dress`, readout and estimate. Run `bun test && bun run typecheck`; the design doc's example link opens right.
- [ ] **Step 2:** `build-stage.ts` tape placing, by pointer, touch and keys; two-finger moves still belong to the camera.
- [ ] **Step 3:** Design it with Impeccable and run its finish review. Update `DESIGN.md`.
- [ ] **Step 4: Check in the browser** at 375, 768, 1280 px: mouse, touch emulation, keyboard only, screen-reader names, reduced motion, sound on and off; a racquet with all numbers, one with none, a junior, an O-Port; copy the link into a private window and compare every value; a damaged link; drag tension for 30 s (no history errors, no leaks, no sound pile-up); Back leaves the page in one step; WebGL off; `strings.json` blocked (stock strings, retry offered).
- [ ] **Step 5:** Run `bun run build`. Expected: no `ZodError` in `dist/assets/*.js`; `index` grows by less than 20 kB gzipped. Commit: `feat: build my racquet`.

### Task 9: Docs

- [ ] **Step 1:** README (the build page; `restring`, `placeTape`, `readout` in code; link format as stable from `v=1`), CHANGELOG (new exports, new optional spec fields, pixel-look fix), CLAUDE.md, PRODUCT.md, roadmap (strings, overgrip, dampener, lead built; restrung download, leather grip, butt-cap lead, weave, presets later).
- [ ] **Step 2:** Run `bun run typecheck && bun test && bun run generate --check && bun run build`. Expected: all pass; `git diff --stat main -- assets` lists only `catalog.json`.
- [ ] **Step 3:** Commit: `docs: build my racquet`. Open a PR; do not merge or tag.

## Order

2 → 3 → 4 → 5 → 6 → 7 → 8 → 9, with 1 (research) running alongside from the start; the page is honest without it, so it never blocks.
