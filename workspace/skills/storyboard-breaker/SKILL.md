---
name: Storyboard breakdown
description: How the script is split into beats, shots and sub-shots, and how each shot is saved.
---

## What you produce

An ordered list of shots covering the whole script. Each shot has:

- `shotNumber`: 1, 2, 3… in story order.
- `title`: a few words naming what happens.
- `durationSeconds`: 8 to 15.
- `sceneId`: the one scene it happens in.
- `characterIds`, `propIds`: only the assets that are visible in this shot.
- `shotType`, `angle`, `movement`: the dominant framing (for example "medium", "eye level", "slow push in").
- `description`: 2 to 4 sub-shot blocks, each starting with `[Shot N]` (N counting from 1 inside the shot), describing framing, action and any dialogue spoken in it, in quotation marks with the speaker's name.
- `atmosphere`: light, weather, sound and mood.
- `videoPrompt`: follow the video-prompt skill of the prompt generator.

## How it is judged

- First find the beats: setup, turns, climax, reversals. A beat change always starts a new shot; two beats never share one.
- A shot never crosses scenes. A new location or time of day starts a new shot.
- Each sub-shot lasts 2 to 6 seconds, and the sub-shots add up to the shot's duration.
- Dialogue needs time: allow at least 1 second per 3 words spoken (1 second per 5 characters for Chinese, Japanese or Korean), plus a second of reaction. If the lines do not fit in 15 seconds, split the shot.
- Every character named in a sub-shot is in `characterIds`; nobody else is.
- The whole script is covered, in order, with nothing added.

## Example description

```
[Shot 1] Wide, rain on the awning; Mei hangs lanterns on a wire, the red one hangs apart. (3 s)
[Shot 2] Medium over Mei's shoulder; the stranger in the grey coat stops and points at the red lantern. STRANGER: "How much for that one?" (4 s)
[Shot 3] Close on Mei's hand freezing on the wire. MEI, without turning: "That one isn't for sale." (4 s)
```

## Tool protocol

1. `read_storyboard_context`.
2. `save_shots` with `{ "replaceExisting": true, "shots": [ …up to 8… ] }` for the first batch.
3. `save_shots` with `{ "shots": [ …up to 8… ] }` for each following batch, continuing the numbering.
4. The batch with the last shot adds `"final": true` (a single batch sets both `replaceExisting` and `final`). The breakdown only counts once the final batch is saved.
