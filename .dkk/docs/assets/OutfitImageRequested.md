# OutfitImageRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

A picture of a character in an episode's outfit was requested (adr-0023); the task carries the episode and the outfit it is drawn for.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | — |
| `taskId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
