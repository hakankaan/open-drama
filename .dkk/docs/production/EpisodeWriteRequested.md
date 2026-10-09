# EpisodeWriteRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

A script was requested for a planned episode; the episode_writer agent should run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `dramaId` | `ID` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `EpisodeWriteJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
