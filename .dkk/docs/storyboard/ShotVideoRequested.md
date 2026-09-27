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



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Shot` |

## Linked ADRs

_No linked ADRs._
