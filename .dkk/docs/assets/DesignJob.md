# DesignJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [assets](index.md)

## Summary

A running design for one drama and one kind (characters, scenes or props), from the story outline (adr-0024). Drama-scoped; at most one job per drama and kind runs at a time, and the three kinds run in parallel. Its progress records the outline revision the run read and the save's counts (saved, filled, skipped, overflow), which are the run's outcome.



## Rules & Invariants

- Key is (dramaId, target); starting while running returns the running job (alreadyRunning) instead of a second run.
- The run is judged by its one save tool having succeeded; a run that never saved is retried once with a reminder, then failed.
- The job's progress carries the outline revision the designer read, so the studio can say when the outline moved on after the design.
- A cancelled job keeps what its save had already written; nothing is rolled back.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `DesignAssets` |
| Emits | `AssetDesignRequested` |
| Emits | `AssetDesignCompleted` |
| Emits | `AssetDesignFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
