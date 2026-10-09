# EpisodeWriteFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The episode writer failed, finished without saving, or was interrupted by a restart; the script stage shows the error and the creator can expand again or rewrite.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `jobId` | `ID` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `EpisodeWriteJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
