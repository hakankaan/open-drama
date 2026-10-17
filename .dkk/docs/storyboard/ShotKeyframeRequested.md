# ShotKeyframeRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [storyboard](index.md)

## Summary

A keyframe image was requested for a shot with its framed prompt and ordered reference images.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `dramaId` | `ID` | — |
| `prompt` | `string` | — |
| `imageServiceId` | `ID` | — |
| `model` | `string` | — |
| `aspectRatio` | `string` | — |
| `referenceImageUrls` | `string[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
