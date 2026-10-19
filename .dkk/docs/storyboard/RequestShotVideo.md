# RequestShotVideo

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Generate a video for the shot. Builds the ordered reference list — bound characters (at most four), then the bound scene, then bound props, at most five bound assets with the ones the prompt mentions chosen first (assets without an image skipped), each sending its cover image, then the shot's uploaded and the request's extra images, then further views of each character as the model's reference policy and image limit allow (a full body, or a sheet composed from headshot and body where the model reads sheets; side and back views for a turnaround model, adr-0018) — deduplicated and capped by the provider's limit, reporting what was left out and recording each character's views; rewrites each @[Name] mention in the prompt into the matching reference slot (the adapter renders the provider's token syntax, or plain text when the provider has none) and timed lines into untimed Shot N lines; frames the prompt with the drama's style, a legend of the slots and the view each shows, a headcount and a wardrobe line for the characters sent, the scene's lighting and the identity, clean-frame and dialogue-language sentences (adr-0017); draws a seed when the model takes one and none was given; applies the episode resolution and the drama aspect ratio; uses the episode's locked video service and pinned model unless a service or model override is given. A shot with a keyframe starts from it on a model that takes a first frame (unless useKeyframe is false or reference video or audio is sent): the keyframe, fitted in 1920 px, goes as the first frame with no reference images, the prompt names the people the plan would have sent and asks them to keep their look from the first frame, and the shot's uploaded images are reported as not sent; the response says whether the keyframe was sent, turned off or not supported. A shot that continues the previous one starts from that shot's last frame instead (adr-0020): the task is claimed at once and, while the previous shot's video is generating, waits for it before taking an episode slot (also after a server restart, which picks the waiting request up again), and fails unsent when the shot no longer continues it after the wait; the frame is taken a quarter second before the end of what the film shows of that clip and recorded on the task with its time and source video; the prompt opens with an unbroken-take sentence, sends no reference images and asks the people to keep their look from the first frame; the response names the shot it continues and whether it is waiting. A continuing shot is refused on Veo, which makes no continued takes, and when it is in another scene than the shot before. A shot the next one can continue is asked to end on a steady moment. In a drama with pinned voices (adr-0021) a shot with a spoken line needs its line audio first: the length grows to hold the half-second lead-in and the line, the video is made without sound, the prompt keeps the speaker's face in view, and the stored video goes on to its lip sync (LipSyncPinnedVideo); a shot without a line is told nobody speaks. Without pinned voices, the speaker's voice sample goes as reference audio where the model takes one and the provider can fetch it. Batch generation and retry-failed issue this once per shot, in story order, a continuing shot after the request for the shot before it, so a shot whose latest video or lip-sync task is still processing is rejected.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `prompt` | `string` | Video prompt (defaults to the shot's) |
| `model` | `string` | — |
| `videoServiceId` | `ID` | — |
| `durationSeconds` | `number` | — |
| `extraReferenceImageUrls` | `string[]` | Optional extra images appended after the bound assets' reference images |
| `referenceVideoUrls` | `string[]` | — |
| `referenceAudioUrls` | `string[]` | — |
| `generateAudio` | `boolean` | — |
| `seed` | `number` | Retake seed; drawn when omitted and the model takes one |
| `useKeyframe` | `boolean` | Start from the shot's keyframe where the model takes a first frame (default true) |

## Rules & Invariants

- At least one reference asset or a non-empty prompt
- Reference counts within the provider's limits
- No video model service configured
- Reference audio without any reference image or video
- Reference material over the provider's limits
- A video task for this shot is still processing
- A seed for a model that takes none
- The shot's keyframe file is missing
- A continuing shot on Veo, which makes no continued takes
- A continuing shot in another scene than the shot before
- A continuing shot on a model that takes no first frame
- A continuing shot with reference video or audio
- A third shot in a row continuing the one before
- A continuing shot whose previous shot has no video and none generating
- Pinned voices and a spoken line without a speaker
- Pinned voices and a spoken line without its line audio
- Pinned voices and a line longer, with its lead-in, than the model's longest video
- Pinned voices and no lip-sync service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
| [adr-0017](../../adr/adr-0017.md) | Video prompt discipline, seeds and a pinned video model | proposed |
| [adr-0018](../../adr/adr-0018.md) | Character reference views | accepted |
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0020](../../adr/adr-0020.md) | Continuous takes between shots | proposed |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
