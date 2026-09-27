# GenerationTaskStatus

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [generation](index.md)

## Summary

One task's current state for polling from the UI — status, error, local result path, provider and model, timestamps.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `type` | `string` | — |
| `status` | `string` | — |
| `provider` | `string` | — |
| `model` | `string` | — |
| `localPath` | `string` | — |
| `error` | `string` | — |
| `createdAt` | `datetime` | — |
| `completedAt` | `datetime` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `GenerationTaskSubmitted` |
| Subscribes to | `GenerationTaskDispatched` |
| Subscribes to | `ImageGenerated` |
| Subscribes to | `VideoGenerated` |
| Subscribes to | `GenerationTaskFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
