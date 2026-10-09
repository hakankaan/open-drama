# EpisodeWriteJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

A running script write for a planned episode. Wraps the episode_writer agent run so the studio can poll it, and records failure explicitly; at most one per episode at a time and never beside a rewrite.



## Rules & Invariants

- Key is the episode; starting while running returns the running job (alreadyRunning) instead of a second run.
- The script has one agent at a time: a write is refused while a rewrite runs and a rewrite while a write runs; a storyboard breakdown, the skip, the creator's content edit and the creator's script edit are refused while either runs.
- Success is judged by SaveScript succeeding during the run, not by the model's reply; the recap chain then runs as after a rewrite.
- A restart marks a running write as failed.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `WriteEpisodeScript` |
| Emits | `EpisodeWriteRequested` |
| Emits | `EpisodeWriteCompleted` |
| Emits | `EpisodeWriteFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
