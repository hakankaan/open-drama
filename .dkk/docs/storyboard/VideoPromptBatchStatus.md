# VideoPromptBatchStatus

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [storyboard](index.md)

## Summary

Progress of the running or last prompt batch for an episode (status, total, completed, failed, current shot).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `status` | `string` | — |
| `total` | `number` | — |
| `completed` | `number` | — |
| `failed` | `number` | — |
| `currentShotId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `VideoPromptBatchStarted` |
| Subscribes to | `ShotVideoPromptSaved` |
| Subscribes to | `VideoPromptBatchCompleted` |
| Subscribes to | `VideoPromptBatchFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
