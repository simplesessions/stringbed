---
name: stringbed
description: A pro-shop demo wall for parametric tennis racquet models.
colors:
  wall: "oklch(0.885 0.006 80)"
  wall-deep: "oklch(0.845 0.007 80)"
  rail: "oklch(0.76 0.008 80)"
  ink: "oklch(0.23 0.01 75)"
  ink-soft: "oklch(0.43 0.012 75)"
  ink-hover: "oklch(0.33 0.012 75)"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.4rem + 2.6vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 76"
  wordmark:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 118"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 660
    lineHeight: 1.15
    fontVariation: "'wdth' 82"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 720
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 84"
  code:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
rounded:
  chip: "6px"
  surface: "12px"
  pill: "999px"
spacing:
  bay-gap: "12px"
  group-gap: "40px"
  page-pad: "clamp(16px, 3.2vw, 48px)"
components:
  button-download:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.wall}"
    rounded: "{rounded.surface}"
    padding: "14px 20px"
  button-download-hover:
    backgroundColor: "{colors.ink-hover}"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.wall}"
  sign:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "7px 12px 6px"
    height: "36px"
  sign-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.wall}"
  part-chip:
    backgroundColor: "{colors.wall-deep}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.chip}"
    padding: "3px 8px"
---

# Design System: stringbed

## Overview

**Creative North Star: "The Demo Wall"**

The gallery is a pro shop's racquet wall. Every frame stands upright at one true scale in a
row of bays, sectioned by brand under a sign, standing on a shelf rail with a hang-tag label
beneath. The comparison is the point: head shape, beam and colourway read because the
neighbours are right there at the same size. The interface is the wall, the rail and the
type; it never competes with the racquets.

The page has no colour of its own. Its ground is a mid-light warm grey chosen so black frames
and white frames both read against it, and its only chromatic moments come from the
racquets: their renders, the swatch mark that slides along the rail on hover, the swatch
chip in the spec sheet. Detail is a second room of the same shop: the racquet taken off the
wall, turning slowly, with its spec tag set beside it.

**Key Characteristics:**
- One warm-grey ground, one ink, no accent: the catalogue's colourways are the palette.
- Racquets at one shared scale, upright, never cropped, never boxed.
- Archivo across the board, its width axis doing the work: condensed for labels and model
  names, wide for the wordmark.
- Flat. Depth comes from the 3D renders and nothing else.
- One signature motion: the turn on hover or focus, off under reduced motion. Moving between
  places is a view transition: the brand sign morphs from aisle to floor, the racquet you open
  lifts off its rail into the stage (and back), and the header holds still. Fans open once on
  arrival. All of it is off under reduced motion.

## Colors

A restrained neutral system: tinted warm greys and a warm near-black ink, with the
racquet swatches as the only colour.

### Neutral
- **Shop Wall** (`wall`, about #dbd9d5): the page ground everywhere, including behind every 3D
  render (both renderers clear to transparent). Mid-light on purpose: white frames and black
  frames both separate from it.
- **Wall Shadow** (`wall-deep`, about #ceccc7): hover fill for signs, the notice band, code chips,
  the soft floor under the detail model.
- **Shelf Rail** (`rail`, about #b4b1ab): the 3 px rail each row of racquets stands on. Decorative
  only; never carries text.
- **Ink** (`ink`, about #201c18): all primary text, active sign fill, the download button, focus
  rings (12:1 on the wall).
- **Soft Ink** (`ink-soft`, about #544f49): secondary text: tag meta, spec labels, hints, the
  lede, counts (5.75:1 on the wall, 5.05:1 on Wall Shadow).
- **Ink Hover** (`ink-hover`, about #39352f): hover state of the ink-filled download button.

### Named Rules
**The Borrowed Colour Rule.** The page owns no hue. Any colour on screen comes from a
racquet's `swatch` or its render; a new accent would compete with the content.

**The Two-Frame Test Rule.** Any ground change must keep both a near-white and a near-black
frame clearly separated from it. That is what fixed the wall's value.

## Typography

**Display Font:** Archivo (variable, self-hosted latin subset, SIL OFL), falling back to the
system sans.
**Body Font:** Archivo.
**Label/Mono Font:** the platform monospace, only for code: part names, file names, hex.

**Character:** One grotesque used like shop signage. The width axis replaces a second family:
narrow and heavy for model names and brand signs, wide for the wordmark, normal for prose.

### Hierarchy
- **Display** (800, wdth 76, clamp 2.25rem to 3.75rem, 0.95): the model name in the detail view.
- **Wordmark** (800, wdth 118, 1.375rem): "stringbed" in the header strip.
- **Brand sign** (780, wdth 72, 0.9375rem, uppercase, 0.07em): brand section headings on the wall.
- **Title** (660, wdth 82, 0.9375rem, 1.15): model names on the hang-tag labels.
- **Body** (400, 1rem, 1.5): prose, spec values (tabular numerals); lede at 0.9375rem, 62ch max.
- **Label** (720, wdth 84, 0.8125rem, uppercase, 0.08em): spec sheet section headings.

### Named Rules
**The One Family Rule.** Archivo's width axis is the hierarchy. Don't add a display face;
reach for wdth and weight.

**The Code Is Mono Rule.** Monospace marks things a developer will type: part names, file
names, hex values. Nothing else.

## Layout

The gallery is a shop floor in three steps: brands, then lines, then sizes.

- **Home (`#/`): one aisle per brand.** Three aisles across from 1100px, two to 721px, one
  below. Each aisle is a sign (2px ink rule, brand name uppercase at wdth 112, widening to
  125 on hover), a fan of up to five current flagships held at the butt caps like a hand of
  cards (biggest line in the middle, the rest alternating out), a rail, and a tally (lines ·
  racquets · colourways · no model yet). The whole aisle is the link.
- **Brand floor (`#/b/<brand>`): one shelf per line.** A display-size brand sign (wdth 125),
  a tally, and a sticky index of the brand's lines. Each shelf is a sign row (line name,
  generation tabs) over a rail on which that generation's sizes stand side by side; the lines
  with most sizes lead. Generation tabs swap the shelf in place. Researched racquets with no
  model close the floor.
- **One true scale everywhere:** thumbnails frame a fixed 29 in with the butt cap on the rail,
  so juniors stand shorter than adult frames. Bays are `clamp(104px, 11.5vw, 168px)` wide and
  height = width / 0.42; long shelves scroll sideways (and bleed to the edges on phones).

The detail view is two columns from 721px: the model stage takes the free width and stays
sticky; the spec sheet is 320 to 400px. Below 721px the stage comes first at 60svh, then the
sheet. Page padding is `clamp(16px, 3.2vw, 48px)`; more space sits above a section than
inside it.

## Elevation & Depth

Flat. No box shadows anywhere. Depth belongs to the racquets: studio-lit PBR renders with a
neutral room environment and Neutral tone mapping. The only other depth cue is a soft
elliptical floor under the detail model, in Wall Shadow, so it reads as standing rather than
floating.

### Named Rules
**The Renders Carry Depth Rule.** If an element needs a shadow to be noticed, it is
competing with the racquets. Use ink weight or a Wall Shadow tint instead.

## Shapes

Small controls are pills (999px): brand signs, outline buttons, retry. Surfaces that hold
content use 12px: the download button, the notice band, the stage. Code chips use 6px.
Racquets are never clipped or framed. The rails are square-ended 3px strips; section signs
sit under a 2px ink rule.

## Components

### Buttons
- **Shape:** pill (999px) for secondary actions, 12px for the primary download.
- **Primary (Download):** an ink slab with wall-coloured text: icon, "Download .<ext>" over the
  file name in mono, and the size on the right in tabular numerals. One per detail view,
  directly under the model name.
- **Outline (Retry, Try again):** 1.5px ink border, transparent; fills with ink on hover.
  Over a silhouette it takes a wall background so the hoop line never crosses its label.
- **Quiet (Reset view):** borderless on a translucent wall wash; Wall Shadow on hover.
- **Focus:** a 2px ink outline, 3px offset (6px on wall bays), everywhere.

### Brand signs (filter)
- **Style:** text pills, ink text, Soft Ink count in tabular numerals.
- **State:** active sign is ink-filled with wall text; hover is Wall Shadow. Exposed as
  `aria-pressed` toggles; a polite live region announces the result.

### Bay (signature component)
A racquet render in its own canvas standing on the shelf rail, with a hang-tag label below
(model in Title, then "Brand · generation" in Soft Ink). Hover or keyboard focus turns the
racquet on its axis and wipes a swatch-coloured mark along its stretch of rail. Loading,
failure and no-WebGL states all show the racquet's flat silhouette in its swatch colour; a
failure adds "Preview failed" and a Retry pill inside the hoop.

### Spec sheet
Rows of label and value separated by hairlines (ink at 16%). Values carry their unit and a
Soft Ink aside (metric conversion, "mains × crosses", "tip / middle / shaft").

## Do's and Don'ts

### Do:
- **Do** draw every racquet at the same scale and upright; frame by height.
- **Do** take colour only from racquet swatches and renders.
- **Do** keep 3D in at most two WebGL contexts: one shared offscreen renderer for all bays,
  one for the detail view.
- **Do** give every 3D state a flat-silhouette fallback in the swatch colour.
- **Do** use the width axis of Archivo for hierarchy, tabular numerals for specs.

### Don't:
- **Don't** show brand logos, wordmarks or string stencils anywhere; names are plain text.
- **Don't** add an accent colour, a dark mode painted by category, or neon tennis-ball yellow.
- **Don't** put racquets in cards, boxes or shadowed tiles.
- **Don't** add eyebrow labels above headings or a second motion effect that competes with
  the turn.
