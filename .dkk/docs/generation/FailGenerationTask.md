# FailGenerationTask

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

Mark the task failed with a creator-readable error (moderation, timeout, provider error, missing configuration).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
