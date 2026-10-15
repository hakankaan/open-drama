# RequestShotVideo

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Generate a video for the shot. Builds the ordered reference list — bound characters (at most four), then the bound scene, then bound props, at most five bound assets with the ones the prompt mentions chosen first (assets without an image skipped), each sending its cover image, then the shot's uploaded and the request's extra images, then further views of each character as the model's reference policy and image limit allow (a full body, or a sheet composed from headshot and body where the model reads sheets; side and back views for a turnaround model, adr-0018) — deduplicated and capped by the provider's limit, reporting what was left out and recording each character's views; rewrites each @[Name] mention in the prompt into the matching reference slot (the adapter renders the provider's token syntax, or plain text when the provider has none) and timed lines into untimed Shot N lines; frames the prompt with the drama's style, a legend of the slots and the view each shows, a headcount and a wardrobe line for the characters sent, the scene's lighting and the identity, clean-frame and dialogue-language sentences (adr-0017); draws a seed when the model takes one and none was given; applies the episode resolution and the drama aspect ratio; uses the episode's locked video service and pinned model unless a service or model override is given. Batch generation and retry-failed issue this once per shot, so a shot whose latest video task is still processing is rejected.


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

## Rules & Invariants

- At least one reference asset or a non-empty prompt
- Reference counts within the provider's limits
- No video model service configured
- Reference audio without any reference image or video
- Reference material over the provider's limits
- A video task for this shot is still processing
- A seed for a model that takes none


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
| [adr-0018](../../adr/adr-0018.md) | Character reference views | proposed |
