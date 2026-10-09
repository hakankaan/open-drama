---
name: The story outline
description: What a story outline holds, how it is sized for a short-drama season and how it is judged.
---

## What the outline holds

Markdown, with these sections in this order:

1. **Logline** — one or two sentences: who wants what, what stands in the way, what it costs.
2. **Cast** — one line per character: name, role in the story, what they want, how they change. Four to six characters for a season; name them as they will be called in the scripts.
3. **World and tone** — where and when, in a paragraph; the few places most scenes happen in; the mood and the pace.
4. **Story** — the story in acts, each a paragraph: the setup, the turn that ends it, and the ending written out. No open ending left to be decided later.
5. **Season shape** — a suggested episode count and episode length in seconds, with where the act breaks fall. The creator reads these numbers into the plan.
6. **Threads** — for a project whose episodes continue one story: the two or three threads that carry across episodes and where each is paid off. Omit for anthologies.

Size: between 800 and 3000 characters for most projects; never above 20 000.

## How it is judged

- Someone who read only the outline could plan every episode without asking a question.
- Every character in the cast has a want and an arc; nobody is there to be explained later.
- The ending is decided, and it answers the logline.
- The season shape fits the story: a story with three turns is not twelve episodes.
- Nothing contradicts an episode already written or planned; the outline passes through them.

## Example (excerpt)

```
## Logline
A lantern seller in a rain-soaked night market refuses to sell the one lantern a stranger wants, and learns what her mother paid for it.

## Cast
- MEI (20s), lantern seller. Wants the shop to survive the season; learns what she is willing to sell.
- THE STRANGER (40s), buyer with a card and no name. Wants the red lantern back; believes it was stolen from him.
- MOTHER (50s). Wants Mei never to know; cannot keep it from her.

## Season shape
6 episodes of about 45 seconds. Act breaks after episodes 2 and 4.
```

## Tool protocol

1. `read_story` with no arguments.
2. `save_outline` with `{ "outline": "<the whole outline>" }`. Save once, with the complete text.
