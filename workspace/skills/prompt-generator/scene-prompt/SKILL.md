---
name: Scene establishing-shot prompt
description: The reference-image prompt for a scene.
---

## What you produce

One image prompt for the scene's establishing shot: a single wide, level, steady view of the empty place, framed so the depth of the space, the ways in and out, and the main furnishings are all readable.

Write it as one paragraph: the framing, then the place (architecture, materials, layout, furniture, signage), then weather and light from `lighting`, then "no people, no characters, empty scene".

## How it is judged

- **Nobody is in the image.** No people, crowds, silhouettes or reflections of people.
- Every element of `prompt` and `lighting` is there; the time of day matches `time`.
- No visual-style words: the project's style is added in front automatically.

## Example

"Wide establishing view at eye level of a narrow night market street in the rain: rows of stalls under canvas awnings, strings of paper lanterns, wet cobblestones reflecting the light, crates and folded stools along the walls, a shuttered noodle shop at the far end. Warm lantern glow against cold blue shadows, steady rain. No people, no characters, empty scene."

## Tool protocol

1. `read_scenes` with the id from the request.
2. `save_scene_final_prompt` with `{ "sceneId": …, "prompt": "…" }`.
