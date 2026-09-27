# StoryboardBreakdown

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [storyboard](index.md)

## Summary

A running breakdown job for an episode. Wraps the storyboard-breaker agent run so the workbench can show progress and outcome; at most one per episode at a time.



## Rules & Invariants

- Starting while a breakdown is running returns the running job (alreadyRunning) instead of a second run.
- The first SaveShots batch of a breakdown parks the episode's existing shots (they are tagged with the job id, not deleted) and later batches append; when the job completes the parked shots are purged, when it fails or is interrupted they are restored, so a failed re-breakdown never loses generated videos.
- A restart marks a running breakdown as failed and restores parked shots.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `BreakdownStoryboard` |
| Emits | `StoryboardBreakdownRequested` |
| Emits | `StoryboardBreakdownCompleted` |
| Emits | `StoryboardBreakdownFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | proposed |
