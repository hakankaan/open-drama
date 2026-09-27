# EpisodeJobs

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

The latest job per kind for an episode — rewrite, extraction per target, storyboard breakdown and video-prompt batch — with status (running / done / failed), progress and error, so the studio polls one endpoint while anything runs. Extraction, breakdown and prompt-batch jobs are owned by the assets and storyboard contexts; this projection reads their rows.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `rewrite` | `JobStatus` | — |
| `extraction` | `JobStatusByTarget` | — |
| `breakdown` | `JobStatus` | — |
| `videoPromptBatch` | `JobStatus` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `ScriptRewriteRequested` |
| Subscribes to | `ScriptRewriteCompleted` |
| Subscribes to | `ScriptRewriteFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
