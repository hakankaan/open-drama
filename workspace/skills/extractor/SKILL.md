---
name: Asset extraction rules
description: Which characters, scenes and props to extract, the fields to fill, and how duplicates are avoided.
---

## What you produce

One kind of asset per run, as named in the request.

**Characters**: everyone who is seen on screen. Fields:
- `name`: the name the script uses; for unnamed extras, a short role ("Street vendor").
- `role`: their part in the story in a few words ("lantern seller, lead").
- `appearance`: age range, build, face, hair, and the one or two traits a viewer should recognise at once. Fold personality into what shows ("restless hands", "a guarded stare").
- `styling`: clothing, colours, accessories, as worn in this episode.
- `description`: optional, one sentence of context.

**Scenes**: each place at a time of day. The same street at night and at dawn are two scenes. Fields:
- `location`: the place, as in the script heading ("Night market").
- `time`: the time of day ("Night").
- `prompt`: the set dressing: architecture, materials, furniture, signage, weather, clutter. No people.
- `lighting`: light sources, colour and mood ("wet neon, warm lantern glow, deep shadows").

**Props**: only objects the plot depends on, 0 to 3 per episode. Fields:
- `name`, `type` (for example "lantern", "letter", "weapon"),
- `description`: the physical object only: shape, material, colour, size, wear. Never its meaning or purpose in the story.

## How it is judged

- Nothing is duplicated. An asset that already exists (same name, or the same name with a qualifier in parentheses removed, or for scenes the same location and time) is sent again with its exact existing name so it gets linked, not re-created.
- Only this episode's assets are sent.
- Before adding a prop, check all three: would the plot break without this object? Is it shown or handled on screen? Must it look the same in several shots? If any answer is no, leave it out. Saving no props is a valid result.
- Narrators and voice-overs are not characters.
- Descriptions are concrete enough to draw from, and contain no camera or style words.

## Example

Script line: "MEI (20s) hangs paper lanterns under a canvas awning. A red lantern hangs apart from the others."

Character: `{ "name": "Mei", "role": "lantern seller, lead", "appearance": "woman in her early twenties, slight build, short black bob, watchful dark eyes, a small scar on her left thumb", "styling": "rain-darkened olive work jacket, rolled sleeves, grey scarf, canvas apron with a pocket of wire hooks" }`

Prop: `{ "name": "Red lantern", "type": "lantern", "description": "round paper lantern about 40 cm across, deep red paper faded at the seams, bamboo ribs, black lacquered top cap, a short red tassel" }`

## Tool protocol

1. `read_script_for_extraction`.
2. `read_existing_characters`, `read_existing_scenes` or `read_existing_props`, matching the request.
3. `save_dedup_characters`, `save_dedup_scenes` or `save_dedup_props` once, with `{ "items": [ … ] }`. An empty list is allowed for props.
