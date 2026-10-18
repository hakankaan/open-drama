# SaveDesignedProps

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Bulk save from the asset designer's save_designed_props tool (adr-0024), the plot-critical props in one call, capped at 5 (the overflow is named in the reply, not saved), every entry with a description; an empty list is valid. Each entry is matched against the drama by name under the extractor's rules; a match gets its empty fields filled and keeps the rest (its final prompt marked stale when a prompt field was filled), a deleted or claimed match is skipped and named, and a new one is created. Nothing is linked to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `props` | `ExtractedProp[]` | name, type, description |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Prop` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
