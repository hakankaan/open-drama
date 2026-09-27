# EpisodeGenerationTasks

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [generation](index.md)

## Summary

The task drawer of the workbench — every generation task belonging to the episode (through its shots and linked assets) newest first, plus the episode's merges, with elapsed time and owner labels.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `tasks` | `TaskRow[]` | — |
| `merges` | `MergeRow[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `GenerationTaskSubmitted` |
| Subscribes to | `ImageGenerated` |
| Subscribes to | `VideoGenerated` |
| Subscribes to | `GenerationTaskFailed` |
| Subscribes to | `GenerationTaskDeleted` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
