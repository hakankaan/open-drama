---
name: The beat sheet
description: What a planned episode holds, how beats are sized to the episode length and how batches are saved.
---

## What a planned episode holds

- **Title** (up to 120 characters): a name, not a summary.
- **Synopsis** (up to 2000 characters): one paragraph of what happens, for the project page.
- **Beats** (200 to 6000 characters): the episode's events in order, numbered, each a sentence or a short paragraph; one beat is one scene's worth of story. The last beat is the hook: the question, arrival or reversal the next episode opens on.

## Sizing beats to the length

The target length is screen time, and the writer fills the beats to it:

- About one scene per 45 seconds. A 45-second episode is one beat and its hook; a 3-minute episode holds four to six beats.
- Dialogue runs about one second per three words; a beat built on a conversation costs more time than a beat built on an action.
- Never pack an act into one short episode: when the outline has more turns than the request has episodes, plan the next stretch at the right pace and stop; the ending waits for a later plan.

## Continuity

- The written episodes' recaps and the planned episodes' beats are what has already happened. The first new episode opens on the last existing episode's hook.
- Characters keep the outline's names and wants. A thread the outline carries across episodes is advanced, not restarted.
- The last requested episode ends on a hook unless it holds the outline's ending.

## Batches

- `save_episodes` takes at most 8 episodes per call, in story order; each call's result names the numbers written and how many remain.
- `final: true` goes on the call that completes the requested count. Sent early, it is refused and the result says how many are still needed; plan them and send `final` again. Once every requested episode exists, `final: true` alone is accepted.

## Example

```
Title: The Red Lantern
Synopsis: A stranger offers Mei more than the shop makes in a month for the one lantern her mother will not sell.
Beats:
1. Night market in the rain; Mei sells the last of the paper lanterns and turns the red one to the wall.
2. The stranger asks for the red one by name and lays a card and a fold of notes on the counter.
3. Hook: Mei refuses, and her mother, in the back room, hears the stranger's name and drops the day's takings.
```

## Tool protocol

1. `read_story_for_planning` with no arguments.
2. `save_episodes` with `{ "episodes": [{ "title": "…", "synopsis": "…", "beats": "…" }, …], "final": false }`, at most 8 per call; `final: true` on the last.
