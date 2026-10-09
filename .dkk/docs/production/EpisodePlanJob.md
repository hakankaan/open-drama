# EpisodePlanJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

A running episode plan for a drama. Wraps the episode_planner agent run, appends planned episodes batch by batch and records progress (added of requested) and failure; at most one per drama at a time.



## Rules & Invariants

- Key is the drama (no episode); starting while running returns the running job (alreadyRunning) instead of a second run.
- The request (count, target length, resolution, the resolved service ids) and the ids of the episodes added so far are the job's progress row, written at start and extended per batch, so a restart or a second process reads the same state.
- The job is done only when the agent marks the last batch final and exactly count of the added episodes are still live; a final sent early is refused naming the shortfall, a second final after a complete one is accepted and changes nothing.
- A failed or interrupted plan keeps the episodes it added (they hold real beats) and reports how many of count were planned.
- A restart marks a running plan as failed.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `PlanEpisodes` |
| Emits | `EpisodePlanRequested` |
| Emits | `EpisodePlanCompleted` |
| Emits | `EpisodePlanFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
