# EpisodeOutfitSet

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

A character's outfit or its picture in an episode changed (adr-0023), set by the creator or written by an extraction that dressed the character from the script (adr-0024); the keyframes of the episode's shots with the character are now stale.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | — |
| `outfit` | `string` | — |
| `outfitPath` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
