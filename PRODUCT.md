# Product

<!-- impeccable:product-schema 1 -->

> Written by the build agent without a live interview (the run was unattended). Facts come
> from the approved design doc, the README, the task brief and the owner's instructions to
> the builder; anything marked _inferred_ is the agent's reading and should be confirmed.

## Platform

web

## Users

Developers and designers who are building tennis apps, sites or games and need racquet
artwork. They arrive with a job: find a model that looks like the real frame, check that it
is light enough to use, and take the file. Some know racquets well enough to tell a Pure
Aero from a Blade at a glance; others only know the brand names. _(audience: from the
owner's brief; the situation and the two levels of racquet knowledge are inferred.)_

## Product Purpose

stringbed is a public library of tennis racquet assets. Each racquet is a small JSON data
file; a parametric generator turns every file into a lightweight `.glb` with named parts
(frame, strings, grip and so on). The gallery is where people browse every asset, inspect
one in 3D and download it. Success: a visitor finds the racquet they want, trusts what it
is (specs, size, triangle count, part names) and leaves with the file.

## Positioning

The racquets are icons, not replicas: each keeps only what gives the frame its identity
(head shape, beam thickness and cross-section, throat, string pattern, colourway), so the
lineup stays distinguishable at thumbnail size and every file stays small. Because they are
generated from data, every frame shares one scale and one coordinate convention, and parts
can be swapped or restyled later.

## Operating Context

- Assets are consumed in web pages, native apps and other projects; many may be shown at
  once, so file size and triangle count matter to the visitor.
- Files are glTF binary, Y up, butt cap at the origin, racquet along +Y, 0.6858 m tall
  (27 in), strings facing +Z. Part names and this convention are a public contract.
- The gallery is a static site on GitHub Pages under `/stringbed/`, reading
  `catalog.json` and the generated files. It is also a smoke test that the published
  assets work.

## Capabilities and Constraints

- v1 lineup: 14 racquets from Babolat, Prince, Solinco, Wilson and Yonex (the roster
  planned 15; see `docs/racquet-roster.md`). One visual style, "Realistic".
- Planned, not built: customization (grips, strings, dampeners) and other visual styles
  (toon, pixel, voxel, some not 3D). The gallery must read styles from the catalog and
  show no style switcher while there is only one.
- At most two WebGL contexts on the page however many racquets exist; works without WebGL
  to the extent of listing racquets, specs and downloads; usable from 375 px; keyboard
  navigable; respects reduced motion.
- No licence has been chosen yet. The page must not claim the assets are free, open or
  licensed in any particular way until the owner picks one.
- Colourways and some specs are estimates in the data (`verified: false`). The catalog
  does not carry that flag; the page makes no claim either way.

## Brand Commitments

- Name: stringbed, lower case.
- No brand logos, wordmarks or string stencils anywhere, in assets or on the site. Brand
  and model names appear only as plain text labels.
- The footer carries the README's trademark line verbatim and a link to the repo
  (`https://github.com/simplesessions/stringbed`).
- The owner chose Impeccable for the gallery's design; its guidance wins over generic
  defaults.

## Evidence on Hand

- `assets/catalog.json` and `assets/realistic/*.glb`: the real content (14 models, about
  4.3–4.7k triangles and 110–135 kB each).
- `docs/racquet-roster.md`: what gives each racquet its identity.
- No screenshots, testimonials, usage numbers or press exist. Do not invent any.

## Product Principles

1. The racquets are the content. The interface exists to get a visitor to the right
   model and the file, then gets out of the way.
2. Show, do not describe: a model's identity is proven by rendering it, at a shared scale,
   next to its neighbours.
3. Tell the truth about the file: format, size, triangles and part names come from the
   catalog, never from copy.
4. Built to grow: more racquets and more styles must slot in without a redesign.

## Accessibility & Inclusion

WCAG 2.2 AA as the working bar _(inferred)_. Keyboard reachable with visible focus,
`prefers-reduced-motion` disables auto-rotation and hover turns, and every 3D preview has
a text equivalent (name, specs, download) that works without WebGL.
