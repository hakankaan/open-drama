# ProviderResultReceived

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [generation](index.md)

## Summary

The provider reported a finished result — a downloadable URL or inline base64 data — that still has to be persisted locally.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `resultUrl` | `string` | — |
| `inlineData` | `string` | base64 payload when the provider returns no URL |
| `mimeType` | `string` | — |
| `durationSeconds` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
