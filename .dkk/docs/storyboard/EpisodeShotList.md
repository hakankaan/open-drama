# EpisodeShotList

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [storyboard](index.md)

## Summary

The video-production stage — every shot of the episode in order with description, atmosphere, duration, bound scene/characters/props (with their reference images and readiness), speaker, line and line audio, video prompt, current video (with poster) and its check, generation, keyframe (and whether it is stale), line-audio and lip-sync status and history, whether a continued video still joins the shot before, plus the breakdown job state.


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
| Subscribes to | `LineAudioRequested` |
| Subscribes to | `LineAudioAttached` |
| Subscribes to | `LipSyncRequested` |
| Subscribes to | `LipSyncedVideoAttached` |
| Subscribes to | `ShotChecked` |
| Subscribes to | `StoryboardBreakdownRequested` |
| Subscribes to | `StoryboardBreakdownCompleted` |
| Subscribes to | `StoryboardBreakdownFailed` |
| Used by | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0020](../../adr/adr-0020.md) | Continuous takes between shots | proposed |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
| [adr-0022](../../adr/adr-0022.md) | Shot checks by a vision model | proposed |
