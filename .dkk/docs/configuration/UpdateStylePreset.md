# UpdateStylePreset

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Edit a style's name, prompt fragment, description, sort order or active flag. The key cannot change.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `presetId` | `ID` | — |
| `name` | `string` | — |
| `prompt` | `string` | — |
| `description` | `string` | — |
| `sortOrder` | `number` | — |
| `isActive` | `boolean` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `StylePreset` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
