# RequestCharacterImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Generate the character's reference image. Ensures a final prompt exists first (generating one if missing, falling back to a locally composed prompt when the agent fails), then requests a 16:9 image through the generation context using the episode's locked image service unless overridden. Batch generation in the UI issues this once per asset with bounded concurrency; there is no server-side batch.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | — |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |
| `textModel` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- An image model service is available (locked or active)
- No image model service configured
- An image task for this character is still processing


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
