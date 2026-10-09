# OutlineFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The story writer failed, finished without saving, or was interrupted by a restart; the story tab shows the error and the creator can write it again or edit the outline by hand. The previous outline is untouched.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `jobId` | `ID` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `OutlineJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
