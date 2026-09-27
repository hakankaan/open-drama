# EpisodeShotList

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [storyboard](index.md)

## Summary

The video-production stage — every shot of the episode in order with description, atmosphere, duration, bound scene/characters/props (with their reference images and readiness), video prompt, current video (with poster), generation status and history, plus the breakdown job state.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `shots` | `ShotCard[]` | each card carries latestVideoTask (status, error class, taskId) — the single source of the shot's generating / failed state |
| `breakdown` | `JobStatus` | — |
| `generatedCount` | `number` | — |
| `totalDurationSeconds` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `ShotsSaved` |
| Subscribes to | `ShotCreated` |
| Subscribes to | `ShotUpdated` |
| Subscribes to | `ShotDeleted` |
| Subscribes to | `ShotVideoPromptSaved` |
| Subscribes to | `ShotVideoRequested` |
| Subscribes to | `ShotVideoAttached` |
| Subscribes to | `StoryboardBreakdownRequested` |
| Subscribes to | `StoryboardBreakdownCompleted` |
| Subscribes to | `StoryboardBreakdownFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
