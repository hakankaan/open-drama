# SetEpisodeResolution

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Change the resolution used for every video generated in this episode (480p, 720p, 1080p). Adapters map it to the nearest provider tier.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `resolution` | `string` | — |

## Rules & Invariants

- Resolution not one of 480p / 720p / 1080p


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
