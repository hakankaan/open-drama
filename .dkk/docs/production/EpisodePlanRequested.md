# EpisodePlanRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

An episode plan was requested for the drama; the episode_planner agent should run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `count` | `number` | — |
| `targetDurationSeconds` | `number` | — |
| `resolution` | `string` | — |
| `imageServiceId` | `ID` | — |
| `videoServiceId` | `ID` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `EpisodePlanJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
