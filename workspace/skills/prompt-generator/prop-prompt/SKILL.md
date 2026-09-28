---
name: Prop product-shot prompt
description: The reference-image prompt for a prop.
---

## What you produce

One image prompt for the prop's product shot: the object alone, whole and centred, at true proportions, photographed like a catalogue item against a plain neutral backdrop with soft even light.

Write it as one paragraph: "Product shot of…", then shape, size, material, colour, details and wear, then "isolated on a plain neutral background, soft even lighting, no hands, no text".

## How it is judged

- Only the object: no hands, no people, no scene, no story.
- Every physical detail of `description` is there.
- No visual-style words: the project's style is added in front automatically.

## Example

"Product shot of a round paper lantern about 40 cm across: deep red paper faded along the seams, thin bamboo ribs, a black lacquered top cap and a short red silk tassel. Isolated on a plain neutral background, soft even lighting, no hands, no text."

## Tool protocol

1. `read_props` with the id from the request.
2. `save_prop_final_prompt` with `{ "propId": …, "prompt": "…" }`.
