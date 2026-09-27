# AttachShotVideo

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Record a completed video generation as the shot's current video and duration. Issued by the generation write-back.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `videoPath` | `string` | — |
| `durationSeconds` | `number` | — |
| `taskId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `Shot` |

## Linked ADRs

_No linked ADRs._
