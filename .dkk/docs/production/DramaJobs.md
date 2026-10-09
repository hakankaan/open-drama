# DramaJobs

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

The latest outline and plan job for a drama, with status (running / done / failed), progress and error, so the project page polls one endpoint while anything runs at drama scope. The plan's progress carries the request and how many of count were added.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `outline` | `JobStatus` | — |
| `plan` | `JobStatus` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `OutlineRequested` |
| Subscribes to | `OutlineCompleted` |
| Subscribes to | `OutlineFailed` |
| Subscribes to | `EpisodePlanRequested` |
| Subscribes to | `PlannedEpisodesAdded` |
| Subscribes to | `EpisodePlanCompleted` |
| Subscribes to | `EpisodePlanFailed` |
| Used by | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
