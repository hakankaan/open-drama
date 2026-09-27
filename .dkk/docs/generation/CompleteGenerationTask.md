# CompleteGenerationTask

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

Mark the task completed with its provider result URL and the local media path where the result was persisted (plus duration for videos). Raises ImageGenerated or VideoGenerated for owners to write back.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `resultUrl` | `string` | — |
| `localPath` | `string` | — |
| `durationSeconds` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
