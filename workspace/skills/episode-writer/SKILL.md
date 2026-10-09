---
name: From beats to script
description: How a beat sheet is expanded into an episode script and how the result is judged.
---

## What you start from

A beat sheet: the episode's events in order, each a sentence or a short paragraph, ending on the hook into the next episode. It was written from the story outline, so it already knows the cast, the arcs and where the season is going.

## How you expand it

- One beat becomes one scene, or two when the location or the time changes inside it. Never merge two beats into one scene that loses one of them.
- A beat states what happens; you decide how: who speaks first, what is said and what is withheld, what the characters do with their hands while they talk, what the place looks and sounds like.
- Dialogue carries the turn of a beat; action carries its mood. A beat that is an event (an arrival, a discovery) opens on the action; a beat that is a decision opens on the line that forces it.
- Keep each character's voice consistent with the earlier episodes' recaps and the outline's cast notes.
- The last scene lands on the beat sheet's hook and ends there. Nothing the next episode's beats open is answered here.

## How it is judged

- Every beat appears, in the beat sheet's order; none is skipped, merged away or moved.
- Nothing contradicts the earlier episodes' recaps or the outline; nothing from the next episode's beats happens early.
- The script fits the target length when one is given: about 30 to 60 seconds of screen time per scene, so a 90-second episode is two or three scenes, not eight.
- The layout follows the shooting script format skill: headings, action paragraphs, dialogue lines, no camera language.

## Example

Beat: "Mei's mother finds the stranger's card in the shop and goes pale; she tells Mei never to speak to him again but will not say why."

```
## S02 | INT Lantern shop, back room | Night

MOTHER (50s) sorts the day's takings at a low table. Among the notes, a white card. She turns it over, reads the address, and the coins stop moving.

Mei comes in with the red lantern and sets it down.

MOTHER (not looking up): Who gave you this?
MEI (lightly): A customer. He wanted the red one.
MOTHER (quietly): You will not speak to him again.

Mei waits for the reason. Her mother folds the card into her sleeve and goes back to counting.
```

## Tool protocol

1. `read_episode_for_writing` with no arguments.
2. `save_script` with `{ "content": "<the whole script>" }`. Save once, with the complete text.
