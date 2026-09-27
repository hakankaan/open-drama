# CreateCharacter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Manually add a character to a drama, optionally linking it to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `episodeId` | `ID` | Optional; links the character to this episode |
| `name` | `string` | — |
| `role` | `string` | — |
| `appearance` | `string` | — |
| `styling` | `string` | — |
| `description` | `string` | — |

## Rules & Invariants

- Empty name


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

_No linked ADRs._
