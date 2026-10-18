---
name: Designing assets from the story
description: How the cast, the places and the props are chosen from a story outline, how many to design, how a designed asset is judged, and how one existing asset is described.
---

## What you produce

One kind of asset per run, as named in the request, for the whole project. The fields of each kind are the ones in the asset fields skill, the same the extractor fills from a script.

**Characters**: the cast the outline names, leads first, then the supporting characters who recur across episodes. Not every name in the outline is a character to design: leave out one-scene walk-ons and anyone the outline mentions only in the past. At most 12 per run; beyond that the save tool names the overflow and does not keep it.

**Scenes**: the places the season returns to, each at the time of day the story shows it there (the same street at night and at dawn are two scenes). Prefer the few places most episodes will use over every place the outline mentions. At most 10.

**Props**: only the objects the plot turns on, shown or handled on screen, that must look the same across episodes (the letter, the lantern, the weapon). Most stories need one or two; none is a valid answer. At most 5.

## Where the look comes from

The outline tells you who and where; the premise (genre, tags, tone) and the world section tell you the period, the place and the mood. Invent the rest to be filmed and recognised: give each character one or two traits a viewer knows them by at a glance, give each place its materials, furniture and weather, and keep the cast and the places consistent with each other (one world, one period). The visual style is named in the story for your bearings only; it is applied when the image is drawn, so no field names it.

## How it is judged

- The names are the outline's, spelled as it spells them; an existing asset's name is reused exactly.
- An existing asset keeps every field it has; the save fills only the empty ones. Design the whole set anyway: the save tool decides what to keep.
- Every field is concrete enough to draw from and contains no camera or style words and no meaning or purpose ("the letter that reveals her past" describes the plot, not the letter).
- Nothing is linked to an episode: an episode's extraction links a designed asset when its script uses it.
- The set is saved once. The tool's reply names what it skipped (deleted names, assets with an image request in flight) and what was over the limit; neither is a reason to call again.

## Describing one asset

A request may name one existing asset, with its fields as they are, instead of a kind to design. The asset was made by hand or extracted from a script; its name, location or time is the creator's and stays. Write only what the request asks for: the empty fields, in the same way the designed ones are written and consistent with the asset's filled fields and the rest of the cast or world; or, when the request says to write them afresh, every describing field, from the story and the asset's name alone. The story may have no outline yet: then the premise and the name are what there is. The reply of the describe tool names what it wrote and what it kept; a filled field it kept was not yours to change, so do not call again for it.

## Tool protocol

1. `read_story_for_design`.
2. `read_existing_characters`, `read_existing_scenes` or `read_existing_props`, matching the request.
3. `save_designed_characters`, `save_designed_scenes` or `save_designed_props` once, with `{ "items": [ … ] }`. Every character carries an `appearance`, every scene a `prompt`, every prop a `description`; an empty list is allowed for props only.

For one asset: `read_story_for_design`, the matching `read_existing_…`, then `describe_character`, `describe_scene` or `describe_prop` once with the fields asked for (a character's `role`, `appearance`, `styling`, `description`; a scene's `prompt`, `lighting`; a prop's `type`, `description`).
