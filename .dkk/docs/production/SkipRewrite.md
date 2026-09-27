# SkipRewrite

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Skip the AI rewrite by copying the raw content into scriptContent, so extraction and storyboard breakdown use it and the skip is persisted (the stage rail shows the script as done after a reload).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |

## Rules & Invariants

- Raw content is not empty


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
