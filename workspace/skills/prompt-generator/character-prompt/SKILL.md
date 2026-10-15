---
name: Character reference prompt
description: The reference-image prompt for a character.
---

## What you produce

One description of the character as a person, which the studio turns into each of their reference images: a close-up of the head first, then the full figure from the front (and, when needed, from the side and the back), each drawn from the headshot so the face stays the same.

Write it as one paragraph: the person first (age, build, face, hair, skin, distinguishing traits), then clothing and accessories from top to bottom. Describe only what the person looks like: the studio adds the framing, the pose, the background and the light of each image, so never write a layout, a view, a camera angle, a pose, a background or lighting.

## How it is judged

- Every trait in `appearance` and `styling` is there; nothing contradicts them.
- One person only, no props they do not wear, no scenery.
- No layout or view words ("sheet", "front, side and back", "portrait", "full body"): each image says its own.
- No visual-style words (medium, art style, rendering): the project's style is added in front automatically.

## Example

"A slight woman in her early twenties with a short black bob, watchful dark eyes, a narrow face with a small mole under her left eye, and a small scar on her left thumb. Rain-darkened olive work jacket with rolled sleeves, grey scarf, canvas apron with a pocket of wire hooks, dark trousers, worn black boots."

## Tool protocol

1. `read_characters` with the id from the request.
2. `save_character_final_prompt` with `{ "characterId": …, "prompt": "…" }`.
