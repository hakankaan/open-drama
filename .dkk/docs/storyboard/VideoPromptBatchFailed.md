# VideoPromptBatchFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [storyboard](index.md)

## Summary

The batch aborted (agent runtime error or restart) before processing every shot; prompts already saved stay, and the creator can start it again for the remaining shots.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `completed` | `number` | — |
| `failed` | `number` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `VideoPromptBatch` |

## Linked ADRs

_No linked ADRs._
