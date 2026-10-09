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
- No rewrite or write job is running for the episode
- Empty raw content
- The script is being rewritten or written


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
