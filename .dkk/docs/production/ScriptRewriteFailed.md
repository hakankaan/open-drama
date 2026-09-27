# ScriptRewriteFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The rewrite agent failed, finished without saving, or was interrupted by a restart; the error is shown and the creator can retry or skip.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `jobId` | `ID` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `ScriptRewriteJob` |

## Linked ADRs

_No linked ADRs._
