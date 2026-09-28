# DeriveRenditions

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [media](index.md)

## Summary

Produce the thumbnail (images) or poster frame (videos, films) for a stored file next to it. Skipped silently when FFmpeg is unavailable for videos.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | — |
| `kind` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `MediaFile` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
