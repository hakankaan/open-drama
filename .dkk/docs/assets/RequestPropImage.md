# RequestPropImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Generate the prop's reference image as a square white-background product shot. Ensures a final prompt first.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `propId` | `ID` | — |
| `episodeId` | `ID` | — |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |
| `textModel` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- No image model service configured
- An image task for this prop is still processing


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Prop` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | proposed |
