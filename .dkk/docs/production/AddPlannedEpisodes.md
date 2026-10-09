# AddPlannedEpisodes

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist one batch of planned episodes produced by the episode planner (its save_episodes tool) as new Episode rows whose raw content is the beat sheet. One transaction per batch: the next numbers are taken inside it, the rows are inserted complete through the same insert CreateEpisode uses, and the new ids are appended to the job's progress.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `episodes` | `PlannedEpisode[]` | At most 8 per batch — title (≤120), synopsis (≤2000), beats (200–6000 characters) |
| `final` | `boolean` | True on the last batch; accepted only once exactly count of the added episodes are live |

## Rules & Invariants

- Called inside a plan job whose progress row holds the request
- Items beyond the requested count
- A title, synopsis or beat sheet outside its bounds
- final while fewer than count of the added episodes are still live (the shortfall is named)
- Called outside a plan job


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
