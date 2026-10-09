# EpisodePlanFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The episode planner failed, stopped short of the requested count, or was interrupted by a restart; the episodes already added stay and the project page shows how many of count were planned with the error.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `jobId` | `ID` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `EpisodePlanJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
