# ShotVideoRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [storyboard](index.md)

## Summary

A video generation was requested for a shot with the fully resolved prompt, references and parameters.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `dramaId` | `ID` | — |
| `prompt` | `string` | — |
| `videoServiceId` | `ID` | — |
| `model` | `string` | — |
| `durationSeconds` | `number` | — |
| `aspectRatio` | `string` | — |
| `resolution` | `string` | — |
| `referenceImageUrls` | `string[]` | — |
| `referenceVideoUrls` | `string[]` | — |
| `referenceAudioUrls` | `string[]` | — |
| `seed` | `number` | — |
| `droppedReferences` | `string[]` | — |
| `firstFrame` | `string` | The keyframe the video started from, when it was sent, or the frame taken from the shot it continues |
| `chainedFrom` | `object` | The shot it continues, and once taken the video and time of the frame it started from |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0017](../../adr/adr-0017.md) | Video prompt discipline, seeds and a pinned video model | proposed |
| [adr-0020](../../adr/adr-0020.md) | Continuous takes between shots | proposed |
