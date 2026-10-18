---
name: Asset fields
description: The fields of a character, a scene and a prop, shared by the extractor (from a script) and the asset designer (from the story), so both write the same kind of asset.
---

## Characters

Everyone who is seen on screen; narrators and voice-overs are not characters. Fields:
- `name`: the name the script or the story uses; for unnamed extras, a short role ("Street vendor").
- `role`: their part in the story in a few words ("lantern seller, lead").
- `appearance`: age range, build, face, hair, and the one or two traits a viewer should recognise at once. Fold personality into what shows ("restless hands", "a guarded stare").
- `styling`: clothing, colours, accessories, as usually worn.
- `description`: optional, one sentence of context.

## Scenes

Each place at a time of day. The same street at night and at dawn are two scenes. Fields:
- `location`: the place, as a script heading would name it ("Night market").
- `time`: the time of day ("Night").
- `prompt`: the set dressing: architecture, materials, furniture, signage, weather, clutter. No people.
- `lighting`: light sources, colour and mood ("wet neon, warm lantern glow, deep shadows").

## Props

Only objects the plot depends on. Before adding one, check all three: would the plot break without this object? Is it shown or handled on screen? Must it look the same in several shots? If any answer is no, leave it out. Saving no props is a valid result. Fields:
- `name`, `type` (for example "lantern", "letter", "weapon"),
- `description`: the physical object only: shape, material, colour, size, wear. Never its meaning or purpose in the story.

## Every field

Concrete enough to draw from, and free of camera words, style words and the visual style's name: the style is applied when the image is made.

## Example

Script line: "MEI (20s) hangs paper lanterns under a canvas awning. A red lantern hangs apart from the others."

Character: `{ "name": "Mei", "role": "lantern seller, lead", "appearance": "woman in her early twenties, slight build, short black bob, watchful dark eyes, a small scar on her left thumb", "styling": "rain-darkened olive work jacket, rolled sleeves, grey scarf, canvas apron with a pocket of wire hooks" }`

Prop: `{ "name": "Red lantern", "type": "lantern", "description": "round paper lantern about 40 cm across, deep red paper faded at the seams, bamboo ribs, black lacquered top cap, a short red tassel" }`
