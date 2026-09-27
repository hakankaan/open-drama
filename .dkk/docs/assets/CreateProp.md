# CreateProp

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Manually add a prop (name, type, physical description) to a drama, optionally linking it to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `episodeId` | `ID` | — |
| `name` | `string` | — |
| `type` | `string` | daily / weapon / document / keepsake … |
| `description` | `string` | — |

## Rules & Invariants

- Empty name


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Prop` |

## Linked ADRs

_No linked ADRs._
