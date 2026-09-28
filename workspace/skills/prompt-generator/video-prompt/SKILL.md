---
name: Shot video prompt
description: The video-generation prompt of one shot.
---

## What you produce

The `videoPrompt` of one shot:

- **A header line** naming who and where: the bound characters and props as mentions, then the scene. Mentions use the exact asset name inside `@[…]`, for example `@[Mei]`, `@[Red lantern]`, `@[Night market]`.
- **One line per 3-second segment**, in order, each starting with its time range: `0-3s: …`, `3-6s: …`. The segments follow the shot's `[Shot N]` sub-shots one to one, in the same order; a sub-shot longer than 3 seconds continues on the next line.

Each segment line says the framing and camera movement, then the action, then any dialogue exactly as written in the description, with the speaker.

## How it is judged

- Mentions are used only for assets bound to the shot, spelled exactly as their names. Unbound names are written as plain words.
- The segments cover the shot's duration and follow its sub-shots.
- Dialogue is copied from the description; nothing is invented or reworded.
- No visual-style words: the project's style is added automatically.

## Example

For a 10-second shot bound to Mei, the stranger, the red lantern and the night market:

```
@[Mei] and @[Stranger] at @[Night market], with @[Red lantern].
0-3s: Wide, static. Rain on the awning; @[Mei] hangs lanterns on a wire, @[Red lantern] hangs apart.
3-6s: Medium over Mei's shoulder, slow push in. @[Stranger] stops and points. Stranger: "How much for that one?"
6-10s: Close on Mei's hand freezing on the wire. Mei, without turning: "That one isn't for sale."
```

## Tool protocol

1. `read_storyboard_context` with `{ "shotId": … }` to see the shot and the names you may mention (`mentionable`).
2. `update_shot` with `{ "shotId": …, "videoPrompt": "…" }` and nothing else.
