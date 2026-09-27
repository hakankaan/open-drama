# SaveExtractedProps

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Batch upsert from the extractor agent's save_dedup_props tool (an empty list is valid). Matches by exact or near name; merges keep the id and clear a stale final prompt when the description changed.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `dramaId` | `ID` | — |
| `props` | `ExtractedProp[]` | name, type, description |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Prop` |

## Linked ADRs

_No linked ADRs._
