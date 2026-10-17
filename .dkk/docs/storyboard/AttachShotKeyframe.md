# AttachShotKeyframe

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Record a completed keyframe image as the shot's keyframe. Issued by the generation write-back.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `keyframePath` | `string` | — |
| `taskId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
