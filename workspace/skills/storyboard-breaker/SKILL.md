---
name: Storyboard breakdown
description: How the script is split into beats, shots and sub-shots, and how each shot is saved.
---

## What you produce

An ordered list of shots covering the whole script. Each shot has:

- `shotNumber`: 1, 2, 3… in story order.
- `title`: a few words naming what happens.
- `durationSeconds`: 8 to 15, or the lengths the job message gives for the video model.
- `sceneId`: the one scene it happens in.
- `characterIds`, `propIds`: only the assets that are visible in this shot.
- `shotType`, `angle`, `movement`: the dominant framing (for example "medium", "eye level", "slow push in").
- `description`: 2 to 4 sub-shot blocks, each starting with `[Shot N]` (N counting from 1 inside the shot), describing framing, one camera movement, action and any dialogue spoken in it, in quotation marks with the speaker's name.
- `atmosphere`: light, weather, sound and mood.
- `videoPrompt`: follow the video-prompt skill of the prompt generator.
- `speakerId`, `line`: when someone speaks in the shot, the one character who speaks (one of its `characterIds`, never a narrator) and their words exactly as in the description, without the name or quotation marks. Leave both out when nobody speaks.
- `continuesPrevious`: true when the shot is one unbroken take with the shot before it: same scene and time, the camera does not cut and the action carries straight on (a walk that goes on, a reaction held from the same angle). The video then starts on the last frame of the shot before. Leave it out otherwise.

## How it is judged

- First find the beats: setup, turns, climax, reversals. A beat change always starts a new shot; two beats never share one.
- A shot never crosses scenes. A new location or time of day starts a new shot.
- Use `continuesPrevious` only where a cut would break the moment, and never on the first shot or after a change of scene; at most two shots in a row continue the one before, since faces drift without a fresh reference.
- Each sub-shot lasts 2 to 6 seconds, and the sub-shots add up to the shot's duration.
- Each sub-shot has one camera movement, slow and gentle, or none; a second move starts a new sub-shot.
- One speaker per shot: a conversation becomes shot and reverse shot, each speaker in a shot of their own, so each voice can be laid on the right face. Narration is not a line.
- Dialogue needs time: allow at least 1 second per 3 words spoken (1 second per 5 characters for Chinese, Japanese or Korean), plus a second of reaction. If the lines do not fit in 15 seconds, split the shot.
- Every character named in a sub-shot is in `characterIds`; nobody else is. A shot holds at most four characters (video models lose faces past four): when more people matter, split the shot; a crowd stays unnamed.
- The whole script is covered, in order, with nothing added.
- With a target length, the shots' durations add up to it. When the script holds more than fits, condense: merge sub-shots, shorten the action, and drop only minor moments, never a beat.

## Example description

```
[Shot 1] Wide, rain on the awning; Mei hangs lanterns on a wire, the red one hangs apart. (3 s)
[Shot 2] Medium over Mei's shoulder; the stranger in the grey coat stops and points at the red lantern. STRANGER: "How much for that one?" (4 s)
[Shot 3] Close on Mei's hand freezing on the wire. (3 s)
```

with `speakerId` the stranger's id and `line` `How much for that one?`. Mei's answer goes in the next shot, with her as its speaker.

## Tool protocol

1. `read_storyboard_context`.
2. `save_shots` with `{ "replaceExisting": true, "shots": [ …up to 8… ] }` for the first batch.
3. `save_shots` with `{ "shots": [ …up to 8… ] }` for each following batch, continuing the numbering.
4. The batch with the last shot adds `"final": true` (a single batch sets both `replaceExisting` and `final`). The breakdown only counts once the final batch is saved.
