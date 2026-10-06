# RecapFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The recap agent failed, finished without saving, found the script moved on, or was interrupted by a restart; the recap card shows the error and the creator can write it again or edit the recap by hand.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `jobId` | `ID` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `RecapJob` |

## Linked ADRs

_No linked ADRs._
