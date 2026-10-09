# EpisodeTargetDurationChanged

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The episode's target length was set or cleared; later rewrites and breakdowns fit the new length.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `targetDurationSeconds` | `number` | null when cleared |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Episode` |

## Linked ADRs

_No linked ADRs._
