# GenerationTaskSubmitted

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [generation](index.md)

## Summary

A task row exists in processing state with its resolved service, model, prompt and parameters.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `type` | `string` | image | video |
| `provider` | `string` | — |
| `model` | `string` | — |
| `ownerRef` | `string` | character:ID | scene:ID | prop:ID (images) | shot:ID (videos) |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
