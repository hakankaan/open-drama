# OutfitImageAttached

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

A generated outfit picture is now the character's full body in that episode (adr-0023); the keyframes of the episode's shots with the character are now stale.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | — |
| `outfitPath` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
