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



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0017](../../adr/adr-0017.md) | Video prompt discipline, seeds and a pinned video model | proposed |
