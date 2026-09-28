---
name: Shooting script format
description: How a formatted episode script is laid out and judged.
---

## What you produce

One script for the episode, made of scenes in story order. Each scene has:

- **A heading line**: `## S<two-digit number> | <INT or EXT> <Location> | <Time of day>`, for example `## S03 | EXT Night market | Night`.
- **Action paragraphs**: short present-tense paragraphs describing what can be seen and heard. One paragraph per visible change.
- **Dialogue lines**: `NAME (state): line`. The state is a few words on how the line is delivered (`quietly`, `laughing`, `not looking up`). Use the same spelling of each name throughout.

A scene should play in roughly 30 to 60 seconds of screen time. Split a longer scene where the location or the time changes, or where the situation turns.

## How it is judged

- Every event of the source appears, in the source's order, and nothing new is invented.
- Every heading names a place a set could be built for, and a time of day.
- No camera language: no "close-up", "cut to", "pan", "we see". Framing is decided later, shot by shot.
- Inner thoughts become something visible or audible (an action, a line, a sound), or they are left out.
- Characters are named consistently; unnamed extras are described by role ("the vendor").

## Example

Source: "Mei had sold lanterns at the night market for three years. When the stranger asked for the red one, she refused, though she could not have said why."

```
## S01 | EXT Night market | Night

Rain drums on a canvas awning. Under it MEI (20s) hangs paper lanterns on a wire, one by one. A red lantern hangs apart from the others.

A STRANGER in a grey coat stops at the stall and points at the red lantern.

STRANGER (politely): How much for that one?
MEI (without turning): That one isn't for sale.

The stranger does not move. Mei's hand stops on the wire.
```

## Tool protocol

1. `read_episode_script` with no arguments.
2. `save_script` with `{ "content": "<the whole script>" }`. Save once, with the complete text.
