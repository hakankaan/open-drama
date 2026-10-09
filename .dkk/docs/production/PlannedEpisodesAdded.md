# PlannedEpisodesAdded

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

One batch of planned episodes was appended to the drama; the episodes tab refreshes its list and the planning count.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `jobId` | `ID` | — |
| `episodeIds` | `ID[]` | — |
| `written` | `number` | How many of the requested count exist after this batch |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
