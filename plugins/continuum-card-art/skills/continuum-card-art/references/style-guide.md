# Continuum card illustration style guide

This guide distils the visual system observed in `Fercho-93/Timeline-ES`.

## Canvas and integration

- Master size: **512 × 768 px**, portrait ratio 2:3.
- Intended use: the image is embedded edge-to-edge in the central visual area of a game card.
- File family: `.webp`; existing illustrated assets are generally kept compact, with a project test expecting illustrated animal assets not to exceed 100 KB.
- The image itself must not contain the surrounding card frame or typography. Names, dates and values belong to the HTML/card layer.

## Palette

Use a narrow, warm, low-saturation range rather than a fixed flat fill:

- aged parchment base: pale ochre / straw / honey beige;
- midtones: muted antique gold and tobacco brown;
- linework and deep accents: umber, sepia brown and restrained near-black brown;
- highlights: desaturated cream, never pure white;
- optional subject colour: only as a very subtle muted tint when needed for recognition, then harmonised back into sepia.

The centre can be slightly lighter than the perimeter. Add a soft vignette, uneven paper fibre and very mild stains or clouding so the surface feels printed and aged. Avoid orange neon, yellow glow, high contrast HDR or a uniformly flat tan background.

## Drawing language

The common medium is an **antique scientific engraving**: precise contour drawing, fine hatching and cross-hatching, stippled texture, etched shadows, layered atmospheric depth and an illustrated natural-history / atlas sensibility. It should feel like a carefully restored plate from an old scientific book, not like a photo filter.

Subjects are rendered with enough detail to reward a closer look, but the focal silhouette remains clear at card scale. Background information supports the fact represented by the card: habitat for an animal, instrument and diagram for astronomy, relief and coastlines for geography, or period objects and architecture for history.

## Composition patterns

Choose one pattern that fits the subject, while keeping the same material language:

1. **Natural-history plate** — subject large and readable, habitat receding behind it.
2. **Scientific tableau** — person or instrument in the lower or middle field, with a restrained diagram or celestial/anatomical scheme above.
3. **Atlas plate** — map or territory dominates, with coherent relief, coast, water and landscape details integrated into the same paper.
4. **Historical scene** — one decisive moment or object, supported by a period setting and a clear visual hierarchy.

Do not turn the card into a collage or split-screen. If a diagram is needed, let it sit in the same plane as the engraving, with similar line weight and opacity.

## Repository references

These are public source examples for visual comparison:

- [Cheetah sample](https://github.com/Fercho-93/Timeline-ES/blob/main/assets/animal-cards/cheetah.webp)
- [Stellar parallax sample](https://github.com/Fercho-93/Timeline-ES/blob/main/assets/astronomy-cards/stellar-parallax.webp)
- [Country atlas sample](https://github.com/Fercho-93/Timeline-ES/blob/main/assets/country-cards/2015.webp)

Use them to calibrate medium, density, edge treatment and colour. Do not reproduce their specific subject, layout or artwork.

## Reusable prompt skeleton

`Single vertical card illustration for Continuum: [SUBJECT / EVENT], showing [DECISIVE ACTION OR DEFINING VISUAL]. Set it in [INFORMATIVE SETTING] with [2–4 CONCRETE SUPPORTING DETAILS]. Strong readable focal subject, balanced portrait composition, edge-to-edge artwork. Antique scientific engraving / natural-history plate / historical atlas illustration, fine etched linework, cross-hatching, stippling, restrained atmospheric depth, printed on warm aged parchment with a soft vignette and subtle paper grain. Narrow muted sepia, ochre, tobacco and umber palette, cream highlights, no saturated colour. Exactly 512×768 px, no frame, no border, no title, no date, no labels, no logo, no watermark, no legible text, no UI, no photo, no glossy 3D render, no cartoon, no vector art, no collage.`
