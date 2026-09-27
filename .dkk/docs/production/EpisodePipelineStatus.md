# EpisodePipelineStatus

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

The stage rail for one episode, derived on read. Script is ready when raw content exists and done when scriptContent exists (rewritten or copied by SkipRewrite); assets report ready/total per type; storyboard reports shot count; videos report shots with a video over total; export reports the latest merge status and film path; completed reflects the manual mark.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `script` | `StepStatus` | — |
| `characters` | `StepStatus` | — |
| `scenes` | `StepStatus` | — |
| `props` | `StepStatus` | — |
| `shots` | `StepStatus` | — |
| `videos` | `StepStatus` | — |
| `merge` | `StepStatus` | — |
| `completed` | `boolean` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `EpisodeContentUpdated` |
| Subscribes to | `ScriptSaved` |
| Subscribes to | `ScriptRewriteSkipped` |
| Subscribes to | `EpisodeStatusChanged` |
| Subscribes to | `EpisodeFilmAttached` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
