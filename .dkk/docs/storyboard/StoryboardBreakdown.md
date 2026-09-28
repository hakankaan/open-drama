# StoryboardBreakdown

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [storyboard](index.md)

## Summary

A running breakdown job for an episode. Wraps the storyboard-breaker agent run so the workbench can show progress and outcome; at most one per episode at a time.



## Rules & Invariants

- Starting while a breakdown is running returns the running job (alreadyRunning) instead of a second run.
- The first SaveShots batch of a breakdown parks the episode's existing shots (they are tagged with the job id, not deleted) and later batches append; when the job completes the parked shots are purged, when it fails or is interrupted they are restored, so a failed re-breakdown never loses generated videos.
- A restart marks a running breakdown as failed and restores parked shots.
- The job succeeds only when the agent saved its last batch marked final; a run that stops early fails and restores the parked shots, so a half-saved storyboard never replaces a complete one. Success (purging the parked shots) and failure (removing the shots the job wrote, unparking the old ones) are recorded atomically with the job status.
- While it runs, the creator cannot create, edit, delete or generate for shots of the episode; it cannot start while a video-prompt batch runs or while any shot video of the episode is still generating.


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
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
