# OutlineJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

A running story-outline write for a drama. Wraps the story_writer agent run so the project page can poll it, and records failure explicitly; at most one per drama at a time.



## Rules & Invariants

- Key is the drama (no episode); starting while running returns the running job (alreadyRunning) instead of a second run.
- Success is judged by SaveOutline succeeding during the run, not by the model's reply; the previous outline stays until then.
- While it runs, the creator's outline edit (UpdateDrama with outline) and PlanEpisodes are refused.
- A restart marks a running outline job as failed.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `WriteOutline` |
| Emits | `OutlineRequested` |
| Emits | `OutlineCompleted` |
| Emits | `OutlineFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
