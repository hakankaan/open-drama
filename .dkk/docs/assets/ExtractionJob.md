# ExtractionJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [assets](index.md)

## Summary

A running extraction for one episode and one target type (characters, scenes or props). Tracks running / done / failed with timestamps so the UI can poll; at most one job per episode and type runs at a time, and the three types may run in parallel.



## Rules & Invariants

- Key is (episodeId, target); starting while running returns the running job (alreadyRunning) instead of a second run.
- Jobs are persisted so an API restart marks any running job as failed instead of leaving it running forever.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `StartExtraction` |
| Emits | `ExtractionStarted` |
| Emits | `ExtractionCompleted` |
| Emits | `ExtractionFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
