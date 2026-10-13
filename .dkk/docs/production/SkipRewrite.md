# SkipRewrite

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Skip the AI rewrite by copying the raw content into scriptContent, so extraction and storyboard breakdown use it and the skip is persisted (the stage rail shows the script as done after a reload). In a serial drama the recap job starts at once and its id is returned with the episode (useContentAsScript in the service layer, adr-0016); an existing script is replaced only when replace is set.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `replace` | `boolean` | Replace an existing script (the studio's button sets it; an assistant must ask first) |

## Rules & Invariants

- Raw content is not empty
- No rewrite or write job is running for the episode
- No breakdown or extraction is reading the script
- Empty raw content
- A script exists and replace is not set
- The script is being rewritten or written
- A breakdown or an extraction is reading the script


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
