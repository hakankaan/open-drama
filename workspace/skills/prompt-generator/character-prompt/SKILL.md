---
name: Character turnaround prompt
description: The reference-image prompt for a character.
---

## What you produce

One image prompt for the character's turnaround sheet: a single image that pairs a head-and-shoulders portrait with the full figure seen from the front, the side and the back, all at the same scale, standing in a neutral pose on a plain light backdrop with even studio light.

Write it as one paragraph: the sheet layout first, then the person (age, build, face, hair, distinguishing traits), then clothing and accessories from top to bottom, then "consistent proportions across all views, plain background, no text".

## How it is judged

- Every trait in `appearance` and `styling` is there; nothing contradicts them.
- One person only, no props they do not wear, no scenery.
- No visual-style words (medium, art style, rendering): the project's style is added in front automatically.

## Example

"Character turnaround sheet: a head-and-shoulders portrait beside three full-body views (front, side, back) at the same scale, neutral standing pose. A slight woman in her early twenties with a short black bob, watchful dark eyes and a small scar on her left thumb. Rain-darkened olive work jacket with rolled sleeves, grey scarf, canvas apron with a pocket of wire hooks, dark trousers, worn black boots. Consistent proportions across all views, plain light background, even studio lighting, no text."

## Tool protocol

1. `read_characters` with the id from the request.
2. `save_character_final_prompt` with `{ "characterId": …, "prompt": "…" }`.
