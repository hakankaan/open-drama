---
name: Episode recap
description: What the recap of an episode contains and how it is judged.
---

## What you produce

One recap of 120 to 250 words, in plain prose, with four things in this order:

- **What changed**: the events that moved the story, with their consequences for the relationships, what was revealed and who now knows it.
- **Where things stand** at the end of the episode: who is where, in what state, with whom.
- **Objects that will matter**: items, places or promises the script set up and later episodes will need.
- **Open threads**: questions the episode left unanswered, in one short sentence each.

Names are spelled exactly as in the script, and a character is called by the same name throughout, never by a role once the name is known.

## How it is judged

- Everything in the recap is in the script; nothing is inferred, guessed or invented.
- Only this episode is covered. The earlier recaps are context for names and references; their events are not retold.
- No camera or style words, no scene headings, no quoted dialogue; a line is reported as what was said, not how it was shot.
- A reader who has not read the script could write the next episode without contradicting this one.
- At most 2000 characters, which the save tool enforces.

## Example

Script: Mei refuses to sell the red lantern to a stranger at the night market; he leaves a card with a foreign address; her mother finds the card and goes pale.

```
Mei, a lantern seller at the night market, refused to sell the red lantern to a stranger in a grey coat who asked for it by name. He left a card with an address in Harbin and said he would return in three days. At home, Mei's mother found the card, went pale, and told Mei never to speak to the man again, without saying why.

At the end of the episode Mei is awake in the shop with the red lantern beside her; her mother is in the back room, the card hidden in her sleeve.

Objects that will matter: the red lantern, which Mei will not sell and whose origin nobody has explained; the stranger's card with the Harbin address.

Open threads: why the stranger knows the lantern's name; what the mother knows about him; whether he returns in three days as promised.
```

## Tool protocol

1. `read_episode_for_recap` with no arguments.
2. `save_recap` with `{ "recap": "<the whole recap>" }`. Save once, with the complete text.
