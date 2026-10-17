# ShotChecked

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [storyboard](index.md)

## Summary

A shot's video was looked over by the vision service; stored only while the shot still plays the video that was judged, and replacing any earlier check.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `videoPath` | `string` | — |
| `model` | `string` | — |
| `verdict` | `string` | ok, or check when any point is flagged |
| `checks` | `ShotQaChecks` | people, outfit, scene and artifacts, each ok, flag or skipped with a note |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0022](../../adr/adr-0022.md) | Shot checks by a vision model | proposed |
