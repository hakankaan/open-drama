# DeleteStylePreset

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Hard-delete a style. Dramas keep their key; a deleted built-in may be re-seeded on restart, so disabling is usually preferable.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `presetId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `StylePreset` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
