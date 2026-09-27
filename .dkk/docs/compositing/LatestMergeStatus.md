# LatestMergeStatus

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [compositing](index.md)

## Summary

The most recent merge of an episode for polling while rendering (status, film path, duration, error).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `mergeId` | `ID` | — |
| `status` | `string` | — |
| `filmPath` | `string` | — |
| `durationSeconds` | `number` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `MergeStarted` |
| Subscribes to | `FilmRendered` |
| Subscribes to | `MergeFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
