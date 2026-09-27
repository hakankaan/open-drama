# GenerationTaskFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [generation](index.md)

## Summary

A task ended in failure with a message the creator can act on (for example switch models after a moderation rejection).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `error` | `string` | — |
| `ownerRef` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
