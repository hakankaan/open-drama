# EpisodeWriteCompleted

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

The episode writer finished and a script was saved; in a serial drama the recap follows (WriteRecapAfterScript).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `jobId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `EpisodeWriteJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
