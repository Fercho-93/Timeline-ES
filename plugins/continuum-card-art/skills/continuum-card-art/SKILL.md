---
name: continuum-card-art
description: "Create or refine Continuum card illustrations that match the repository's established 512×768 sepia parchment, antique engraving and scientific-atlas visual language across existing and future decks."
---

# Continuum Card Art

Use this skill whenever the user asks to create, regenerate, extend or review an illustration for a Continuum card, including cards from a new deck that does not yet exist. It governs the image itself; it does not decide card data, chronology, game rules, filenames or repository integration unless the user also asks for those tasks.

## Source of truth

Read [references/style-guide.md](references/style-guide.md) before generating an image. Treat the existing repository samples as the visual authority, especially:

- `assets/animal-cards/cheetah.webp` for a subject isolated within a natural scene.
- `assets/astronomy-cards/stellar-parallax.webp` for scientific diagrams, instruments and historical figures.
- `assets/country-cards/2015.webp` for cartographic and geographic subjects.

If the repository is available, inspect several current samples from the relevant family before producing a batch. Do not copy a particular composition or recognizable artwork; preserve the shared design system while inventing a new scene for the requested subject.

## Required output

- Generate a finished vertical raster illustration at exactly 512×768 pixels, preferably WebP for the game assets.
- Keep the entire image as the card artwork. Do not add a card frame, border, title, date, statistic, logo, UI, watermark or legible text inside the artwork; the application supplies the card chrome and metadata.
- Use a warm monochrome sepia palette with restrained darker brown linework and a gently lighter central field. The image must feel printed on aged parchment, not like a modern full-colour digital illustration.
- Use a detailed but readable antique engraving / natural-history plate / scientific-atlas treatment: fine cross-hatching, etched contours, stippling, soft paper grain, atmospheric fading toward the edges and historically plausible explanatory visual details.
- Make the main subject immediately identifiable at the small in-game card size. Give it a strong silhouette and a clear focal hierarchy; avoid tiny clutter and avoid placing essential anatomy or symbols against the darkest edge.
- Fill the canvas edge to edge. No white margins, transparent corners, hard rectangular photo edges or pasted-on cut-outs.

## Adaptation by subject

Keep the same medium and palette, then choose the most informative scene for the deck:

- Animals: a full or three-quarter natural-history depiction, with habitat cues and enough negative space around the body. Use realistic anatomy and movement; do not make it a cartoon or a generic stock-photo recreation.
- Astronomy, science and medicine: combine the historical subject, apparatus or phenomenon with restrained diagrams, orbital lines, star fields, anatomical plates or laboratory context when they clarify the event. Diagrams should look etched into the same paper, not overlaid in a different style.
- Countries, places and geography: build an atlas-like composition using coastlines, relief, mountains, rivers, vegetation, settlements or a symbolic cultural landmark. Maps should be geographically coherent and integrated into the parchment scene.
- History, entertainment, technology and future decks: depict the defining object, person or event in a period-appropriate tableau, retaining the engraved print language even when the subject is modern.

## Prompt construction

Write prompts in this order: subject and decisive visual action; informative setting; composition and focal point; medium and rendering; palette and paper; output constraints. Mention “single vertical card illustration” and “no text or border” explicitly. Prefer concrete visual nouns over abstract labels such as “make it look like the other cards.”

Use negative constraints to prevent common drift: `no colour photography, no glossy 3D render, no cartoon, no modern vector art, no UI, no title, no date, no watermark, no white border, no split panels, no collage, no legible text`.

## Quality gate

Before delivery, verify:

1. The canvas is 512×768 and the subject is legible as a thumbnail.
2. The dominant appearance is coherent sepia parchment, with no accidental saturated colours.
3. The artwork reaches all four edges and contains no generated text or border.
4. The composition is specific to the requested card and does not reuse a neighbouring card's scene.
5. If preparing repository assets, use a stable lowercase kebab-case filename, WebP format, and keep the file within the project's existing size expectations (normally below 100 KB when practical).

When the image fails any gate, regenerate or edit it before declaring it ready. If the user asks only for a prompt, return the prompt using this same specification without generating or modifying repository files.
