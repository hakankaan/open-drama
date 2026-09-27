# CreateScene

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Manually add a scene (location, time, description, lighting) to a drama, optionally linking it to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `episodeId` | `ID` | — |
| `location` | `string` | — |
| `time` | `string` | — |
| `prompt` | `string` | Set-dressing description |
| `lighting` | `string` | — |

## Rules & Invariants

- Empty location


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Scene` |

## Linked ADRs

_No linked ADRs._
