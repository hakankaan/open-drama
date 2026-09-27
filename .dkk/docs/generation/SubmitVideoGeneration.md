# SubmitVideoGeneration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

Create a video generation task for a shot with the prompt, reference images/videos/audio, duration, aspect ratio, resolution and audio flag. Validated against the resolved provider's reference limits before the row is created.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `dramaId` | `ID` | — |
| `prompt` | `string` | — |
| `referenceImageUrls` | `string[]` | — |
| `referenceVideoUrls` | `string[]` | — |
| `referenceAudioUrls` | `string[]` | — |
| `firstFrameUrl` | `string` | — |
| `lastFrameUrl` | `string` | — |
| `durationSeconds` | `number` | — |
| `aspectRatio` | `string` | — |
| `resolution` | `string` | — |
| `generateAudio` | `boolean` | — |
| `seed` | `number` | — |
| `model` | `string` | — |
| `videoServiceId` | `ID` | — |

## Rules & Invariants

- Neither prompt nor any reference supplied
- Reference counts exceed the provider limits
- No video model service resolvable


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
