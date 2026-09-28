# StoreInlineImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [media](index.md)

## Summary

Decode a base64 image returned inline by a provider (for example Gemini) and store it with the extension matching its MIME type.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `base64Data` | `string` | — |
| `mimeType` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `MediaFile` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
