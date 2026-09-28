# VideoPromptBatch

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [storyboard](index.md)

## Summary

A batch job that runs the prompt-generator agent once per shot to fill missing video prompts (or regenerate selected ones), tracking total, completed, failed and the current shot.



## Rules & Invariants

- One batch per episode at a time; starting while running returns the running job (alreadyRunning). Success per shot is judged by a non-empty video prompt actually persisted.
- The agent is told which video model the episode locked so it respects that model's duration and style limits.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `StartVideoPromptBatch` |
| Emits | `VideoPromptBatchStarted` |
| Emits | `VideoPromptBatchCompleted` |
| Emits | `VideoPromptBatchFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
