---
name: Shot video prompt
description: The video-generation prompt of one shot.
---

## What you produce

The `videoPrompt` of one shot: **one line per sub-shot**, in order, each starting with `Shot N:` (N counting from 1). The lines follow the shot's `[Shot N]` sub-shots one to one. Give no times or durations: video models do not keep them, and a timed line makes the result worse.

Each line says the framing and its one camera movement, then the action, then any dialogue. Mentions use the exact asset name inside `@[…]`, for example `@[Mei]`, `@[Red lantern]`, `@[Night market]`.

## How it is judged

- Every time a bound character or prop appears, it is written as its mention, never as "she", "he" or a description: `@[Mei] turns`, not `she turns`. The scene is mentioned in the first line.
- Mentions are used only for assets bound to the shot, spelled exactly as their names. Unbound names are written as plain words.
- One camera movement per line, slow and gentle (static, slow push in, slow pan); never two moves in one line.
- Dialogue is copied from the description, nothing invented or reworded, one speaker per line, in braces after the speaker: `@[Stranger] says: {How much for that one?}`. Sounds go in angle brackets: `<rain on the awning>`.
- No visual-style words, no lighting, and no instructions about faces, subtitles or watermarks: the studio adds the project's style, the scene's lighting and those instructions on its own.
- The prompt says what is seen and heard; it is not a copy of the script.

## Example

For a 10-second shot bound to Mei, the stranger, the red lantern and the night market:

```
Shot 1: Wide, static. Rain on the awning at @[Night market]; @[Mei] hangs lanterns on a wire, @[Red lantern] hangs apart. <rain on the awning>
Shot 2: Medium over @[Mei]'s shoulder, slow push in. @[Stranger] stops and points at @[Red lantern]. @[Stranger] says: {How much for that one?}
Shot 3: Close on @[Mei]'s hand freezing on the wire, static. @[Mei], without turning, says: {That one isn't for sale.}
```

## Tool protocol

1. `read_storyboard_context` with `{ "shotId": … }` to see the shot and the names you may mention (`mentionable`).
2. `update_shot` with `{ "shotId": …, "videoPrompt": "…" }` and nothing else.
