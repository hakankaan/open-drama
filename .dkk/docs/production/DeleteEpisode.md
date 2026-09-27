# DeleteEpisode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Soft-delete an episode. Its shots and generation records are kept but no longer reachable; later episodes keep their numbers.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |

## Rules & Invariants

- Episode not found


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
