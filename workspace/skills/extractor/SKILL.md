---
name: Asset extraction rules
description: Which characters, scenes and props to extract from an episode's script and how duplicates are avoided; the fields are in the asset fields skill.
---

## What you produce

One kind of asset per run, as named in the request, from this episode's script: the characters seen on screen, the places at a time of day, or the plot-critical props (0 to 3). The fields of each kind, and what makes a prop plot-critical, are in the asset fields skill, injected with this one.

## How it is judged

- Nothing is duplicated. An asset that already exists (same name, or the same name with a qualifier in parentheses removed, or for scenes the same location and time) is sent again with its exact existing name so it gets linked, not re-created. A character, place or prop the asset designer made from the story usually exists already: send it under its name, and only what it lacks is filled in.
- Only this episode's assets are sent.
- Saving no props is a valid result.
- Narrators and voice-overs are not characters.
- Descriptions are concrete enough to draw from, and contain no camera or style words.

## Dressing an existing character for this episode

A character's `styling` is the look they are usually drawn in, and it is never rewritten from a script. When this episode shows an existing character in different clothes (a uniform for the gala, the same jacket soaked and torn, a disguise), send those clothes as that character's `outfit`: this episode's clothing, colours and accessories only, concrete, no camera or style words, no reason for the change. The outfit is saved for this episode alone and only while the episode has none for that character yet; one already set is kept, so an outfit is never a reason to call the save again. A new character gets no `outfit`: their `styling` is what this script shows them in. Send no `outfit` when the character wears their usual styling.

## Tool protocol

1. `read_script_for_extraction`.
2. `read_existing_characters`, `read_existing_scenes` or `read_existing_props`, matching the request.
3. `save_dedup_characters`, `save_dedup_scenes` or `save_dedup_props` once, with `{ "items": [ … ] }`. A character item may carry `"outfit": "…"`; an empty list is allowed for props.
