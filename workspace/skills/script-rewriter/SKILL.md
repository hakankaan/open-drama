---
name: Rewriting from a source
description: How raw source material is turned into the episode script and how the result is judged.
---

## What you start from

Raw source material: a novel chapter, an outline, loose notes or a shot list. It may be far longer than the episode, written in prose and in the past tense, with inner thoughts and narration.

## How it is judged

- Every event of the source appears, in the source's order, and nothing new is invented.
- Narration becomes action and dialogue; what cannot be seen or heard is left out.
- Filler is cut; a scene the source makes thin is written briefly rather than padded.
- The layout follows the shooting script format skill: headings, action paragraphs, dialogue lines, no camera language.

## Example

Source: "Mei had sold lanterns at the night market for three years. When the stranger asked for the red one, she refused, though she could not have said why."

The scene in the format skill's example is this source rewritten: the three years become the practised way she hangs the lanterns, the refusal becomes a line, and "she could not have said why" becomes her hand stopping on the wire.

## Tool protocol

1. `read_episode_script` with no arguments.
2. `save_script` with `{ "content": "<the whole script>" }`. Save once, with the complete text.
