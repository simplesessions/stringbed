# stringbed v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 15 recognisable, lightweight 3D tennis racquets from data files and publish a GitHub Pages gallery to browse and download them.

**Architecture:** Three layers. A JSON spec per racquet (`racquets/`) is turned by `src/core` into a style-neutral model of named parts, which a style (`src/styles/realistic`) writes out as a `.glb`. A static Vite site (`site/`) reads `assets/catalog.json` and displays the generated files.

**Tech Stack:** Node 22+, TypeScript (ESM, strict), three.js (geometry in Node and rendering in the browser), `@gltf-transform/core` (GLB writing in Node), zod (spec validation), Vitest, Vite, GitHub Actions + GitHub Pages. Gallery designed with the Impeccable skill.

**Spec:** `docs/superpowers/specs/2026-11-19-stringbed-design.md`. Also read `docs/racquet-roster.md` and `docs/roadmap.md`.

## Global Constraints

- No brand logos, wordmarks or string stencils anywhere: not in assets, not on the site.
- Part names are exactly: `frame`, `bumper`, `grommets`, `strings_mains`, `strings_crosses`, `grip`, `collar`, `butt_cap`, `dampener`. Material names are `mat_<part name>`.
- Coordinates: metres, Y up, butt cap at origin, racquet along +Y, string bed in the XY plane, +Z is the face normal. 27 in = 0.6858.
- Per racquet: at most 15,000 triangles and 150 KB `.glb`. No textures.
- Generation is deterministic: running it twice produces byte-identical files.
- `src/core` imports nothing from `src/styles`, `src/export` or `site`. The site never assumes `.glb`; it reads file paths from the catalog.
- Files in `assets/` are generated and committed. Never edit them by hand.
- Site base path is `/stringbed/`. At most two WebGL contexts on the page at any time.
- Do not write GLB with three.js `GLTFExporter` in Node (it needs browser `FileReader`/`Blob`). Use `@gltf-transform/core`.
- If any library API here does not match the installed version, read that library's docs rather than guessing.

## Review Focus

1. **Even vs odd mains.** 16 and 18 mains have no centre string; a future 17-main pattern would. Expected: mains are always symmetric about X = 0. (Test in Task 5.)
2. **Non-standard length.** A 27.5 in spec must come out 0.6985 tall with the extra length in the handle/throat, not a stretched head. (Test in Task 3.)
3. **Bad spec data.** A typo'd colour (`#12G`), an unknown head shape, or a string pattern of `[0, 19]` must fail validation with the file name and field in the message, not produce a broken mesh. (Test in Task 2.)
4. **Catalog or model fails to load on the site.** Expected: the racquet list still renders with names and specs, and the failed model shows a retry control, not a blank canvas. (Test in Task 9.)
5. **Deployed under a sub-path.** Every asset URL must work at `/stringbed/`, not only at `/`. (Check in Task 11.)

---

## File Structure

```
racquets/<brand>/<id>.json        one spec per racquet (15)
src/core/spec.ts                  RacquetSpec type, zod schema, loadSpec, loadAllSpecs
src/core/units.ts                 inch/mm/sq-in conversions
src/core/outline.ts               head outline curves and area normalisation
src/core/layout.ts                where handle, throat and head sit along Y
src/core/section.ts               beam cross-section polygons
src/core/frame.ts                 hoop + throat + shaft mesh, with frame coordinate u
src/core/handle.ts                grip, collar, butt cap
src/core/strings.ts               mains and crosses
src/core/trim.ts                  bumper, grommets, o-ports, aero fins, dampener
src/core/paint.ts                 vertex colours from paint zones and pattern
src/core/build.ts                 buildRacquet(spec) -> RacquetModel
src/styles/types.ts               Style interface
src/styles/realistic.ts           the v1 style
src/styles/index.ts               style registry
src/export/glb.ts                 model -> GLB bytes via glTF-Transform
scripts/generate.ts               CLI: specs -> assets/ + catalog.json
assets/realistic/<id>.glb         generated
assets/catalog.json               generated
site/                             Vite root for the gallery
tests/                            mirrors src/
.github/workflows/ci.yml          test + regenerate-is-a-no-op check
.github/workflows/pages.yml       build and deploy the site
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `src/core/units.ts`
- Test: `tests/core/units.test.ts`

**Interfaces:**
- Produces: `inToM(inches: number): number`, `mmToM(mm: number): number`, `sqInToSqM(sqIn: number): number` from `src/core/units.ts`.
- Produces npm scripts: `test` (vitest run), `generate` (tsx scripts/generate.ts), `dev` (vite), `build` (vite build), `typecheck` (tsc --noEmit).

- [ ] **Step 1: Initialise the package.** `npm init -y`; set `"type": "module"`, `"private": true`, `"engines": {"node": ">=22"}`. Install `three zod @gltf-transform/core` and dev deps `typescript tsx vitest vite @types/three @types/node`.
- [ ] **Step 2: Config.** `tsconfig.json`: strict, `module`/`moduleResolution` `NodeNext` or `Bundler`, `target` ES2022, include `src`, `scripts`, `site`, `tests`. `vite.config.ts`: `root: 'site'`, `base: '/stringbed/'`, `publicDir: '../assets'`, `build.outDir: '../dist'`, `build.emptyOutDir: true`.
- [ ] **Step 3: Write the failing test**

```ts
import { inToM, mmToM, sqInToSqM } from '../../src/core/units';
test('unit conversions', () => {
  expect(inToM(27)).toBeCloseTo(0.6858, 6);
  expect(mmToM(26)).toBeCloseTo(0.026, 9);
  expect(sqInToSqM(100)).toBeCloseTo(0.064516, 6);
});
```

- [ ] **Step 4:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 5:** Implement the three functions in `src/core/units.ts`.
- [ ] **Step 6:** Run `npm test && npm run typecheck`. Expected: PASS, no type errors.
- [ ] **Step 7: Commit** — `chore: scaffold project`

---

### Task 2: Spec schema and the 15 racquet specs

**Files:**
- Create: `src/core/spec.ts`, `racquets/<brand>/<id>.json` × 15
- Modify: `docs/racquet-roster.md` (replace recalled values with verified ones)
- Test: `tests/core/spec.test.ts`, `tests/racquets.test.ts`

**Interfaces:**
- Produces, from `src/core/spec.ts`:

```ts
export type HeadShape = 'oval' | 'isometric' | 'teardrop';
export type BeamProfile = 'box' | 'ellipse' | 'aero' | 'tapered-box';
export type Finish = 'matte' | 'satin' | 'gloss';
export type Feature = 'o-ports' | 'aero-fins';
export type HexColor = string; // "#rrggbb"

export interface RacquetSpec {
  id: string;                    // kebab-case, equals the file name, e.g. "babolat-pure-aero-100"
  brand: string;                 // "Babolat"
  line: string;                  // "Pure Aero"
  model: string;                 // display name, "Pure Aero 100"
  generation: string;            // "2026", "v10", "V2"
  year: number;
  specs: {
    headSizeSqIn: number;        // 85..115
    lengthIn: number;            // 26..29
    stringPattern: [number, number]; // [mains, crosses], each 12..22
    beamMm: [number, number, number]; // [tip, mid, shaft], each 14..32
    unstrungWeightG?: number;
  };
  geometry: {
    head: { shape: HeadShape; aspect: number };   // aspect = inner length / inner width, 1.2..1.45
    beam: { profile: BeamProfile };
    throat: { style: 'open-v' | 'open-u'; bridge: 'curved' | 'flat' };
    features: Feature[];
  };
  paint: {
    base: HexColor;
    finish: Finish;
    zones: Array<{ from: number; to: number; color: HexColor; blend?: number }>; // from/to are frame coordinate u, 0..1
    pattern?: { type: 'camo'; color: HexColor; scale: number; seed: number };
  };
  parts: {
    grip: { color: HexColor };
    collar: { color: HexColor };
    buttCap: { color: HexColor };
    strings: { color: HexColor; gaugeMm: number };   // gauge 1.0..1.4
    grommets: { color: HexColor };
    bumper: { color: HexColor };
    dampener: null | { color: HexColor };
  };
  sources: string[];             // URLs
  verified: boolean;
}

export const racquetSpecSchema: z.ZodType<RacquetSpec>;
export function parseSpec(data: unknown, fileName: string): RacquetSpec; // throws Error naming fileName and the failing field path
export function loadAllSpecs(dir?: string): RacquetSpec[];               // Node only; sorted by brand then model; default dir "racquets"
```

Frame coordinate `u`: 0 at the base of the shaft (top of the grip), rising through the throat and around the hoop, 1 at the head tip. Both sides of the racquet share the same `u`. Reference points for writing zones: shaft 0–0.12, throat 0.12–0.35, lower hoop 0.35–0.55, sides 0.55–0.80, shoulders 0.80–0.93, tip 0.93–1.

- [ ] **Step 1: Write the failing schema tests** in `tests/core/spec.test.ts`. Build one valid object `good` inline, then:

```ts
test('accepts a valid spec', () => { expect(parseSpec(good, 'x.json').id).toBe(good.id); });
test('rejects a bad colour, naming file and field', () => {
  const bad = structuredClone(good); bad.paint.base = '#12G';
  expect(() => parseSpec(bad, 'babolat/x.json')).toThrow(/babolat\/x\.json.*paint\.base/s);
});
test('rejects an unknown head shape', () => {
  const bad: any = structuredClone(good); bad.geometry.head.shape = 'square';
  expect(() => parseSpec(bad, 'x.json')).toThrow(/geometry\.head\.shape/);
});
test('rejects a zero-main string pattern', () => {
  const bad = structuredClone(good); bad.specs.stringPattern = [0, 19];
  expect(() => parseSpec(bad, 'x.json')).toThrow(/stringPattern/);
});
test('rejects a zone with from >= to', () => {
  const bad = structuredClone(good); bad.paint.zones = [{ from: 0.6, to: 0.4, color: '#ffffff' }];
  expect(() => parseSpec(bad, 'x.json')).toThrow(/zones/);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/core/spec.ts` with the ranges in the interface comments above. `loadAllSpecs` reads `racquets/*/*.json` and checks `id` equals the file's base name.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Verify the roster.** For each of the 15 rows in `docs/racquet-roster.md`, open the manufacturer's product page (fall back to Tennis Warehouse) and confirm: the model is current, head size, string pattern, beam widths, length, unstrung weight, and the standard colourway. Look at product photos for: head shape, beam cross-section, throat style, which regions of the frame carry which colour, grip and bumper colour. Update the roster's values and change the trust column to "verified" with the date. Apply the Solinco Shadow fallback in the roster if it cannot be confirmed. If a newer generation than the one listed is current, use the newer one and note the change.
- [ ] **Step 6: Write the 15 spec files** from the verified roster. One file per racquet at `racquets/<brand-lowercase>/<id>.json`, `verified: true`, `sources` filled. Describe colourways with `paint.base` plus two to five `zones`; do not chase small decals. Solinco specs use `paint.pattern` of type `camo`. Ripstick (and the Phantom if the O3 version is chosen) get `features: ["o-ports"]`; VCORE gets `["aero-fins"]`.
- [ ] **Step 7: Write the roster tests** in `tests/racquets.test.ts`:

```ts
const specs = loadAllSpecs();
test('every spec parses and ids are unique', () => {
  expect(new Set(specs.map(s => s.id)).size).toBe(specs.length);
});
test('five brands, at least two and at most three racquets each', () => {
  const byBrand = Object.groupBy(specs, s => s.brand);
  expect(Object.keys(byBrand).sort()).toEqual(['Babolat', 'Prince', 'Solinco', 'Wilson', 'Yonex']);
  for (const list of Object.values(byBrand)) { expect(list!.length).toBeGreaterThanOrEqual(2); expect(list!.length).toBeLessThanOrEqual(3); }
});
test('every Yonex head is isometric', () => {
  for (const s of specs.filter(s => s.brand === 'Yonex')) expect(s.geometry.head.shape).toBe('isometric');
});
test('every Solinco has a camo pattern', () => {
  for (const s of specs.filter(s => s.brand === 'Solinco')) expect(s.paint.pattern?.type).toBe('camo');
});
test('every spec is verified and sourced', () => {
  for (const s of specs) { expect(s.verified).toBe(true); expect(s.sources.length).toBeGreaterThan(0); }
});
```

- [ ] **Step 8:** Run `npm test`. Expected: PASS.
- [ ] **Step 9: Commit** — `feat: spec schema and v1 racquet specs`

---

### Task 3: Head outline and layout

**Files:**
- Create: `src/core/outline.ts`, `src/core/layout.ts`
- Test: `tests/core/outline.test.ts`, `tests/core/layout.test.ts`

**Interfaces:**
- Consumes: `RacquetSpec`, unit helpers.
- Produces:

```ts
export type Vec2 = { x: number; y: number };
// Closed loop of the INNER edge of the hoop (the string-bed boundary), centred on the origin,
// first point at the tip (0, +halfLength), proceeding clockwise, n points, symmetric about x = 0.
// Scaled so its polygon area equals headSizeSqIn and its length/width equals aspect.
export function headOutline(shape: HeadShape, headSizeSqIn: number, aspect: number, n: number): Vec2[];
export function polygonArea(loop: Vec2[]): number;      // square metres, positive
export function outlineHalfWidthAt(loop: Vec2[], y: number): number;

export interface Layout {
  totalLength: number;   // metres
  gripTopY: number;      // top of the grip; u = 0
  bridgeY: number;       // lowest point of the inner hoop
  headCenterY: number;   // centre of the outline
  tipY: number;          // outer tip of the frame; equals totalLength
}
export function computeLayout(spec: RacquetSpec, hoopRadial: number): Layout;
```

Shape guidance: `oval` is a superellipse with exponent about 2.2 and a slight egg bias (widest point a little above centre). `isometric` raises the exponent in the top half to roughly 2.8–3.2 so the top is squared off and the widest point sits higher. `teardrop` narrows the bottom half. Tune by eye in Task 10; the tests below pin only what matters.

Layout guidance: the grip is 0.178 m long for a 27 in racquet. Head dimensions come from the outline, never from length. Any length beyond 27 in is added to the grip and throat, not the head.

- [ ] **Step 1: Write the failing tests**

```ts
test('outline area matches head size for every shape', () => {
  for (const shape of ['oval', 'isometric', 'teardrop'] as const) {
    const loop = headOutline(shape, 100, 1.3, 128);
    expect(polygonArea(loop)).toBeCloseTo(sqInToSqM(100), 4);
  }
});
test('outline is symmetric and starts at the tip', () => {
  const loop = headOutline('oval', 98, 1.3, 128);
  expect(loop[0].x).toBeCloseTo(0, 6);
  expect(loop[0].y).toBeGreaterThan(0);
  for (let i = 1; i < 64; i++) { expect(loop[i].x).toBeCloseTo(-loop[128 - i].x, 6); expect(loop[i].y).toBeCloseTo(loop[128 - i].y, 6); }
});
test('aspect ratio is honoured', () => {
  const loop = headOutline('oval', 100, 1.35, 256);
  const xs = loop.map(p => p.x), ys = loop.map(p => p.y);
  expect((Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs))).toBeCloseTo(1.35, 2);
});
test('isometric is visibly squarer at the top than oval', () => {
  const iso = headOutline('isometric', 100, 1.3, 256), oval = headOutline('oval', 100, 1.3, 256);
  const y = 0.75 * Math.max(...oval.map(p => p.y));
  expect(outlineHalfWidthAt(iso, y)).toBeGreaterThan(outlineHalfWidthAt(oval, y) * 1.06);
});
test('layout: 27 in racquet', () => {
  const l = computeLayout(spec27, 0.011);
  expect(l.tipY).toBeCloseTo(0.6858, 4); expect(l.gripTopY).toBeCloseTo(0.178, 3);
  expect(l.bridgeY).toBeGreaterThan(l.gripTopY + 0.08);
});
test('layout: extra length goes below the head', () => {
  const a = computeLayout(spec27, 0.011), b = computeLayout({ ...spec27, specs: { ...spec27.specs, lengthIn: 27.5 } }, 0.011);
  expect(b.tipY).toBeCloseTo(0.6985, 4);
  expect(b.tipY - b.bridgeY).toBeCloseTo(a.tipY - a.bridgeY, 5);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `outline.ts` and `layout.ts`. Normalise area by uniform scaling after fixing the aspect ratio.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: head outline and layout`

---

### Task 4: Frame mesh

**Files:**
- Create: `src/core/section.ts`, `src/core/frame.ts`
- Test: `tests/core/section.test.ts`, `tests/core/frame.test.ts`

**Interfaces:**
- Consumes: `headOutline`, `computeLayout`, `RacquetSpec`.
- Produces:

```ts
// Cross-section polygon in (radial, z) metres, centred on the origin, counter-clockwise.
// thickness is the published beam width (z extent); radial is the in-plane extent.
export function beamSection(profile: BeamProfile, thickness: number, radial: number): Vec2[];
export const HOOP_RADIAL: Record<BeamProfile, number>; // in-plane beam extent, metres; 0.010..0.013

// Beam thickness in metres at frame coordinate u, interpolating spec.specs.beamMm:
// shaft value at u = 0, mid value at u = 0.65, tip value at u = 1 (smooth interpolation).
export function beamThicknessAt(spec: RacquetSpec, u: number): number;

// One merged BufferGeometry: hoop + two throat arms + bridge + shaft down to gripTopY.
// Attributes: position, normal, and a float attribute "u" (itemSize 1) with the frame coordinate per vertex.
export function buildFrame(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;
```

Section guidance: `box` is a rounded rectangle; `ellipse` is an ellipse; `aero` is a flattened, wide ellipse with pinched leading and trailing edges (radial extent larger, about 0.013); `tapered-box` is `box` whose radial extent also narrows toward the shaft. The hoop is the section swept around the outline, offset outward so the outline is the inner edge. Throat arms leave the hoop at roughly the 5 and 7 o'clock positions and converge on the shaft at `gripTopY`; `open-v` arms are straight, `open-u` arms bow outward. The bridge closes the bottom of the hoop between the arms: `curved` follows the outline, `flat` is straighter.

- [ ] **Step 1: Write the failing tests**

```ts
test('section extents match inputs', () => {
  for (const p of ['box', 'ellipse', 'aero', 'tapered-box'] as const) {
    const s = beamSection(p, 0.026, 0.011);
    expect(Math.max(...s.map(v => v.y)) - Math.min(...s.map(v => v.y))).toBeCloseTo(0.026, 4);
  }
});
test('box section is fuller than ellipse at the corners', () => {
  expect(polygonArea(beamSection('box', 0.021, 0.011))).toBeGreaterThan(polygonArea(beamSection('ellipse', 0.021, 0.011)) * 1.1);
});
test('beam thickness interpolates tip/mid/shaft', () => {
  // spec with beamMm [23, 26, 22]
  expect(beamThicknessAt(spec, 1)).toBeCloseTo(0.023, 4);
  expect(beamThicknessAt(spec, 0.65)).toBeCloseTo(0.026, 4);
  expect(beamThicknessAt(spec, 0)).toBeCloseTo(0.022, 4);
});
test('frame spans grip top to tip and is symmetric', () => {
  const g = buildFrame(spec, layout); g.computeBoundingBox(); const b = g.boundingBox!;
  expect(b.max.y).toBeCloseTo(layout.tipY, 3); expect(b.min.y).toBeCloseTo(layout.gripTopY, 3);
  expect(b.min.x).toBeCloseTo(-b.max.x, 4); expect(b.min.z).toBeCloseTo(-b.max.z, 4);
});
test('frame z extent equals the thickest beam value', () => {
  const g = buildFrame(spec, layout); g.computeBoundingBox();
  expect(g.boundingBox!.max.z * 2).toBeCloseTo(0.026, 3);
});
test('frame has a u attribute within 0..1 and under 9000 triangles', () => {
  const g = buildFrame(spec, layout); const u = g.getAttribute('u');
  expect(u.count).toBe(g.getAttribute('position').count);
  for (let i = 0; i < u.count; i++) { expect(u.getX(i)).toBeGreaterThanOrEqual(0); expect(u.getX(i)).toBeLessThanOrEqual(1); }
  expect(g.index!.count / 3).toBeLessThan(9000);
});
test('a thin box beam and a thick ellipse beam produce different silhouettes side-on', () => {
  // blade-like [21,21,21] box vs pure-drive-like [23,26,23] ellipse: compare max z
  expect(zExtent(thick)).toBeGreaterThan(zExtent(thin) * 1.2);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `section.ts` and `frame.ts`. Compute normals with `computeVertexNormals()` after merging; keep hard edges on `box` sections by not sharing vertices across corners.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: frame mesh with beam profiles and throat`

---

### Task 5: Handle, strings and trim

**Files:**
- Create: `src/core/handle.ts`, `src/core/strings.ts`, `src/core/trim.ts`
- Test: `tests/core/handle.test.ts`, `tests/core/strings.test.ts`, `tests/core/trim.test.ts`

**Interfaces:**
- Consumes: `Layout`, `headOutline`, `RacquetSpec`.
- Produces:

```ts
export function buildGrip(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;     // octagonal, y from butt cap top to gripTopY, slight taper
export function buildCollar(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;   // band at gripTopY, about 0.012 tall
export function buildButtCap(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;  // flared octagon, y 0..0.02
export function mainPositions(count: number, innerWidth: number): number[];             // x positions, metres, ascending, symmetric about 0
export function buildMains(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;
export function buildCrosses(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;
export function buildBumper(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry;   // outer rim of the hoop over the top, roughly 10 to 2 o'clock
export function buildGrommets(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry; // thin strip on the outer rim of the rest of the hoop; includes o-port insets when spec has "o-ports"
export function buildDampener(spec: RacquetSpec, layout: Layout): THREE.BufferGeometry | null; // null when spec.parts.dampener is null
```

Guidance: each string is a 4-sided prism of width `gaugeMm`, clipped to the inner outline, lying at z = 0 (crosses and mains may sit ±0.3 mm apart to avoid z-fighting; no weave). Mains are spaced slightly tighter in the centre than at the edges; crosses run from just above the bridge to just below the tip. O-ports are dark oval insets on the outer rim at 3 and 9 o'clock (and 5 and 7 if it reads better), not real holes. `aero-fins` adds a small raised ridge to the frame's outer tip; build it in `trim.ts` and merge it into the bumper.

- [ ] **Step 1: Write the failing tests**

```ts
test('grip is octagonal and spans butt cap to grip top', () => {
  const g = buildGrip(spec, layout); g.computeBoundingBox();
  expect(g.boundingBox!.max.y).toBeCloseTo(layout.gripTopY, 3);
  expect(g.boundingBox!.max.x * 2).toBeGreaterThan(0.028); expect(g.boundingBox!.max.x * 2).toBeLessThan(0.040);
});
test('butt cap sits on the origin and is wider than the grip', () => {
  const c = buildButtCap(spec, layout); c.computeBoundingBox(); const g = buildGrip(spec, layout); g.computeBoundingBox();
  expect(c.boundingBox!.min.y).toBeCloseTo(0, 5); expect(c.boundingBox!.max.x).toBeGreaterThan(g.boundingBox!.max.x);
});
test('main positions are symmetric for even and odd counts', () => {
  for (const n of [16, 17, 18]) {
    const xs = mainPositions(n, 0.25); expect(xs).toHaveLength(n);
    for (let i = 0; i < n; i++) expect(xs[i]).toBeCloseTo(-xs[n - 1 - i], 6);
  }
  expect(mainPositions(17, 0.25)[8]).toBeCloseTo(0, 6);
  expect(mainPositions(16, 0.25).every(x => Math.abs(x) > 1e-4)).toBe(true);
});
test('strings stay inside the head and match the pattern', () => {
  const m = buildMains(spec1619, layout), c = buildCrosses(spec1619, layout);
  expect(m.index!.count / 3).toBe(16 * 8); expect(c.index!.count / 3).toBe(19 * 8);
  m.computeBoundingBox(); expect(m.boundingBox!.max.y).toBeLessThan(layout.tipY); expect(m.boundingBox!.min.y).toBeGreaterThan(layout.bridgeY - 0.002);
});
test('18x20 has more string triangles than 16x18', () => {
  expect(tris(buildMains(spec1820, layout)) + tris(buildCrosses(spec1820, layout))).toBeGreaterThan(tris(buildMains(spec1618, layout)) + tris(buildCrosses(spec1618, layout)));
});
test('o-ports add geometry to the grommets', () => {
  expect(tris(buildGrommets(specWithOPorts, layout))).toBeGreaterThan(tris(buildGrommets(specWithout, layout)));
});
test('no dampener unless the spec asks for one', () => {
  expect(buildDampener(spec, layout)).toBeNull();
  expect(buildDampener({ ...spec, parts: { ...spec.parts, dampener: { color: '#ff0000' } } }, layout)).not.toBeNull();
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: handle, strings and trim parts`

---

### Task 6: Paint

**Files:**
- Create: `src/core/paint.ts`
- Test: `tests/core/paint.test.ts`

**Interfaces:**
- Consumes: frame geometry with the `u` attribute; `RacquetSpec['paint']`.
- Produces:

```ts
// Linear-RGB colour at frame coordinate u, before any pattern: base, overridden by zones in order;
// a zone's `blend` (0..0.5, in u units, default 0) fades it in and out at both ends.
export function paintColorAt(paint: RacquetSpec['paint'], u: number): [number, number, number];
// Adds a "color" attribute (itemSize 3, linear RGB) to the frame geometry, applying zones and then the pattern.
export function applyPaint(frame: THREE.BufferGeometry, paint: RacquetSpec['paint']): void;
export function hexToLinear(hex: HexColor): [number, number, number];
```

Guidance: `camo` is deterministic value noise over vertex position, seeded by `pattern.seed`, stretched along the frame's length to suggest stripes, thresholded to switch between the zone colour and `pattern.color`. No `Math.random()`.

- [ ] **Step 1: Write the failing tests**

```ts
test('base colour where no zone applies', () => {
  expect(paintColorAt({ base: '#ffffff', finish: 'gloss', zones: [{ from: 0.5, to: 0.8, color: '#000000' }] }, 0.2)).toEqual([1, 1, 1]);
});
test('zone colour inside a zone; later zones win', () => {
  const p = { base: '#ffffff', finish: 'gloss' as const, zones: [{ from: 0.4, to: 0.9, color: '#000000' }, { from: 0.6, to: 0.7, color: '#ff0000' }] };
  expect(paintColorAt(p, 0.5)).toEqual([0, 0, 0]); expect(paintColorAt(p, 0.65)).toEqual([1, 0, 0]);
});
test('blend fades between base and zone', () => {
  const c = paintColorAt({ base: '#ffffff', finish: 'gloss', zones: [{ from: 0.5, to: 0.9, color: '#000000', blend: 0.1 }] }, 0.55);
  expect(c[0]).toBeGreaterThan(0.05); expect(c[0]).toBeLessThan(0.95);
});
test('applyPaint writes one colour per vertex', () => {
  applyPaint(frame, paint); expect(frame.getAttribute('color').count).toBe(frame.getAttribute('position').count);
});
test('camo is deterministic and uses both colours', () => {
  const a = frameClone(), b = frameClone(); applyPaint(a, camoPaint); applyPaint(b, camoPaint);
  expect(Array.from(a.getAttribute('color').array)).toEqual(Array.from(b.getAttribute('color').array));
  const share = fractionOfVerticesMatching(a, hexToLinear(camoPaint.pattern!.color));
  expect(share).toBeGreaterThan(0.15); expect(share).toBeLessThan(0.85);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `paint.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: frame paint zones and camo pattern`

---

### Task 7: Assemble the model

**Files:**
- Create: `src/core/build.ts`
- Test: `tests/core/build.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces:

```ts
export type PartName = 'frame' | 'bumper' | 'grommets' | 'strings_mains' | 'strings_crosses' | 'grip' | 'collar' | 'butt_cap' | 'dampener';
export interface Part {
  name: PartName;
  geometry: THREE.BufferGeometry;       // position, normal; frame also has color
  surface: { color: HexColor; finish: Finish; vertexColors: boolean };
}
export interface RacquetModel { spec: RacquetSpec; parts: Part[] }
export function buildRacquet(spec: RacquetSpec): RacquetModel;   // parts in the PartName order above; dampener omitted when null
export function triangleCount(model: RacquetModel): number;
```

Surface defaults: frame uses `paint.finish` and `vertexColors: true` with colour `#ffffff`; grip `matte`; strings `satin`; bumper, grommets, collar, butt cap `satin`.

- [ ] **Step 1: Write the failing tests** (run over `loadAllSpecs()`):

```ts
test.each(loadAllSpecs())('$id builds within budget', (spec) => {
  const m = buildRacquet(spec);
  expect(m.parts.map(p => p.name)).toEqual(['frame', 'bumper', 'grommets', 'strings_mains', 'strings_crosses', 'grip', 'collar', 'butt_cap']);
  expect(triangleCount(m)).toBeLessThanOrEqual(15000);
  const box = unionBox(m);
  expect(box.min.y).toBeCloseTo(0, 4); expect(box.max.y).toBeCloseTo(inToM(spec.specs.lengthIn), 3);
  expect(box.min.x).toBeCloseTo(-box.max.x, 3);
  for (const p of m.parts) for (const v of p.geometry.getAttribute('position').array) expect(Number.isFinite(v)).toBe(true);
});
test('no two racquets with different geometry fields share a silhouette', () => {
  // signature = rounded [head width, head length, max z extent, shape, profile]; all distinct geometry inputs give distinct signatures
});
test('core does not import styles, export or site', () => {
  // read every file in src/core and assert no import path contains "/styles", "/export" or "site/"
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `build.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: buildRacquet assembles named parts`

---

### Task 8: Realistic style, GLB export and the generator

**Files:**
- Create: `src/styles/types.ts`, `src/styles/realistic.ts`, `src/styles/index.ts`, `src/export/glb.ts`, `scripts/generate.ts`
- Generated: `assets/realistic/*.glb`, `assets/catalog.json`
- Test: `tests/export/glb.test.ts`, `tests/generate.test.ts`

**Interfaces:**
- Consumes: `RacquetModel`, `loadAllSpecs`.
- Produces:

```ts
export interface Style {
  id: string;                 // "realistic"
  kind: '3d' | '2d';
  extension: string;          // "glb"
  label: string;              // "Realistic"
  render(model: RacquetModel): Promise<Uint8Array>;
}
export const styles: Style[];                       // from src/styles/index.ts; v1 contains only realistic
export function modelToGlb(model: RacquetModel, materialFor: (part: Part) => { baseColor: [number, number, number]; metallic: number; roughness: number }): Promise<Uint8Array>;

// assets/catalog.json
export interface Catalog {
  version: 1;
  styles: Array<{ id: string; kind: '3d' | '2d'; label: string; extension: string }>;
  racquets: Array<{
    id: string; brand: string; line: string; model: string; generation: string; year: number;
    specs: RacquetSpec['specs'];
    swatch: HexColor;                       // paint.base, for placeholders
    parts: PartName[];
    assets: Record<string, { path: string; bytes: number; triangles: number }>; // keyed by style id; path relative to assets/, e.g. "realistic/babolat-pure-aero-100.glb"
  }>;
}
```

GLB structure: one scene, one root node named with the racquet `id`, one child node per part named with the part name, one mesh and one material (`mat_<part>`) each. Frame mesh includes `COLOR_0`. Finish to PBR: matte roughness 0.85, satin 0.55, gloss 0.25; metallic 0 everywhere. Write no generator timestamp or other varying metadata. Quantise floats to 5 decimal places before writing so output is stable across machines.

`scripts/generate.ts`: loads all specs, renders every style, writes files and `catalog.json` (2-space JSON, racquets sorted by brand then model), prints a table of id / triangles / bytes, exits non-zero if any file exceeds 150 KB. `--check` flag: generate in memory and exit non-zero if anything differs from what is on disk.

- [ ] **Step 1: Write the failing tests**

```ts
test('GLB round-trips with named nodes and materials', async () => {
  const bytes = await realistic.render(buildRacquet(spec));
  const doc = await new NodeIO().readBinary(bytes);
  const names = doc.getRoot().listNodes().map(n => n.getName());
  expect(names).toEqual(expect.arrayContaining(['frame', 'grip', 'strings_mains', 'strings_crosses', 'butt_cap', 'collar', 'bumper', 'grommets']));
  expect(doc.getRoot().listMaterials().map(m => m.getName())).toContain('mat_grip');
  expect(doc.getRoot().listTextures()).toHaveLength(0);
  const frame = doc.getRoot().listNodes().find(n => n.getName() === 'frame')!;
  expect(frame.getMesh()!.listPrimitives()[0].getAttribute('COLOR_0')).not.toBeNull();
});
test('GLB is deterministic and under 150 KB', async () => {
  const a = await realistic.render(buildRacquet(spec)), b = await realistic.render(buildRacquet(spec));
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  expect(a.byteLength).toBeLessThanOrEqual(150 * 1024);
});
test('catalog lists every spec with an asset per style', () => {
  // after running generate into a temp dir: racquets.length === loadAllSpecs().length,
  // every assets.realistic.path exists on disk and bytes matches the file size
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the style, the exporter and the script. If a racquet exceeds 150 KB, lower tessellation in `frame.ts` rather than adding compression.
- [ ] **Step 4:** Run `npm test && npm run generate && npm run generate -- --check`. Expected: PASS, table printed, check exits 0.
- [ ] **Step 5: Commit** — `feat: realistic style, GLB export and generator` (include `assets/`)

---

### Task 9: Gallery

**Files:**
- Create: `site/index.html`, `site/src/**` (structure is the builder's call), `PRODUCT.md` / `DESIGN.md` or whatever Impeccable's setup produces
- Test: `tests/site/catalog-view.test.ts` (logic only), plus a browser check

**Interfaces:**
- Consumes: `assets/catalog.json` (`Catalog` type) and the files it points to, fetched relative to `import.meta.env.BASE_URL`.
- Produces: a static site in `dist/` via `npm run build`.

Functional requirements (the design is Impeccable's and the builder's):

1. Browse all racquets, with brand filtering or grouping. Each entry shows the model rendered in 3D, brand, model and generation.
2. A detail view per racquet with an orbitable model (drag to rotate, scroll or pinch to zoom, a reset control), published specs (head size, length, pattern, beam, weight), the list of part names, triangle count, file size and a download link. Detail views are deep-linkable by URL hash (`#/<racquet id>`).
3. At most two WebGL contexts. One approach: a single shared renderer that draws each grid entry and blits it into that entry's 2D canvas, re-rendering only on hover or when it enters view; a second renderer for the detail view.
4. Reads styles from the catalog. With one style, show no style switcher, but do not hardcode `realistic` or `.glb` outside one default constant.
5. If the catalog fails to load: an error message with a retry button. If one model fails: that entry shows its `swatch` colour, its name, and a retry control; the rest of the page works.
6. Without WebGL: the list, specs and download links still work.
7. From 375 px wide; keyboard reachable with visible focus; `prefers-reduced-motion` disables auto-rotation.
8. No logos. A footer line with the trademark disclaimer from the README and a link to the repo.

- [ ] **Step 1: Set up Impeccable's project context.** Read `.claude/skills/impeccable/SKILL.md` and follow its first-run setup (its "teach"/context step). Feed it: audience is developers and designers picking assets for tennis apps; the racquets are the content and the page should get out of their way; the owner chose Impeccable specifically, so follow its guidance over generic defaults. Commit whatever context files it creates.
- [ ] **Step 2: Write failing logic tests** for a pure module `site/src/catalog-view.ts`:

```ts
export function groupByBrand(c: Catalog): Array<{ brand: string; racquets: Catalog['racquets'] }>; // brands alphabetical
export function assetUrl(base: string, path: string): string;
export function parseRoute(hash: string): { racquetId: string | null };

test('assetUrl respects the base path', () => {
  expect(assetUrl('/stringbed/', 'realistic/x.glb')).toBe('/stringbed/realistic/x.glb');
  expect(assetUrl('/', 'realistic/x.glb')).toBe('/realistic/x.glb');
});
test('parseRoute', () => {
  expect(parseRoute('#/wilson-blade-98-v10')).toEqual({ racquetId: 'wilson-blade-98-v10' });
  expect(parseRoute('')).toEqual({ racquetId: null });
});
test('groupByBrand sorts brands', () => {
  expect(groupByBrand(catalog).map(g => g.brand)).toEqual(['Babolat', 'Prince', 'Solinco', 'Wilson', 'Yonex']);
});
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL. Implement the module. Run again. Expected: PASS.
- [ ] **Step 4: Build the page** using Impeccable for the design, covering requirements 1–8.
- [ ] **Step 5: Browser check.** Run `npm run dev`, open the page, and confirm with screenshots: all racquets render; filtering works; a detail view opens, orbits and deep-links; the download link returns a `.glb`; at 375 px nothing overflows; console has no errors. Then rename one `.glb` temporarily and confirm requirement 5; block `catalog.json` and confirm the retry path. Restore both.
- [ ] **Step 6:** Run Impeccable's audit/critique on the page and fix what it finds.
- [ ] **Step 7:** Run `npm run build`. Expected: `dist/` contains `index.html`, `catalog.json` and `realistic/*.glb`.
- [ ] **Step 8: Commit** — `feat: gallery site`

---

### Task 10: Likeness review

The generator is only right if the racquets are recognisable. This task is a loop, not a checklist item to tick quickly.

**Files:**
- Modify: `racquets/**/*.json`, and `src/core/outline.ts`, `section.ts`, `frame.ts`, `trim.ts`, `paint.ts` where a trait is not expressible
- Generated: `assets/**`

- [ ] **Step 1:** For each racquet, put a screenshot of the gallery detail view (front and three-quarter views) next to the manufacturer's product photo. Judge only: head shape, beam thickness and section, throat shape, string density, colour placement, grip and bumper colour.
- [ ] **Step 2:** Fix mismatches in the spec first. Change generator code only when the spec cannot express the trait, and keep every change general (a parameter, not a special case for one racquet id).
- [ ] **Step 3: Line-up test.** View all racquets in the grid at thumbnail size. Every Yonex must be identifiable as Yonex by head shape alone; the Pure Aero by its beam; Solinco by camo; Prince O-Port models by the ports. Within a brand, the three models must be tellable apart.
- [ ] **Step 4:** Run `npm test && npm run generate && npm run generate -- --check`. Expected: PASS.
- [ ] **Step 5: Commit** — `fix: tune racquet likeness`

---

### Task 11: CI, Pages and docs

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/pages.yml`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: `ci.yml`** on push and pull request: Node 22, `npm ci`, `npm run typecheck`, `npm test`, `npm run generate -- --check`.
- [ ] **Step 2: `pages.yml`** on push to `main`: `npm ci`, `npm run build`, upload `dist` with `actions/upload-pages-artifact`, deploy with `actions/deploy-pages`. Permissions: `pages: write`, `id-token: write`, `contents: read`.
- [ ] **Step 3: Enable Pages** from Actions: `gh api -X POST repos/simplesessions/stringbed/pages -f build_type=workflow` (if it already exists, `-X PUT` with the same field).
- [ ] **Step 4: Update README:** remove the "design only" status; add the live gallery link `https://simplesessions.github.io/stringbed/`; add "Using an asset" (direct file URL, the part names, the coordinate convention, a five-line three.js `GLTFLoader` example that recolours `grip`); add "Adding a racquet" (create a JSON spec, `npm run generate`, commit); keep the trademark section; link the roadmap for customization and visual styles. Update `CLAUDE.md` with the npm scripts.
- [ ] **Step 5:** Push, then confirm both workflows pass with `gh run watch`.
- [ ] **Step 6: Verify the live site.** Open `https://simplesessions.github.io/stringbed/`, confirm every model loads (no 404s in the network panel, which would mean a base-path bug), and that a deep link to one racquet works on a fresh load. Set the repo homepage: `gh repo edit simplesessions/stringbed --homepage https://simplesessions.github.io/stringbed/`.
- [ ] **Step 7: Commit** — `ci: tests, generation check and Pages deploy`

---

## Not in this plan

Customization UI, additional styles, npm packaging, thumbnails and compression. See `docs/roadmap.md`. A licence file is waiting on the owner's choice (see the design doc's open items).
