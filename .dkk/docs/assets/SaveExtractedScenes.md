# SaveExtractedScenes

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Batch upsert from the extractor agent's save_dedup_scenes tool. Matches by normalised location plus time; matches are reused and enriched, new ones created; all are linked to the episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `dramaId` | `ID` | — |
| `scenes` | `ExtractedScene[]` | location, time, prompt, lighting |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Scene` |

## Linked ADRs

_No linked ADRs._
