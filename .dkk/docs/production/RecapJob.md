# RecapJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

A running recap write for one script revision of an episode. Wraps the recap_writer agent run so the studio can poll it, and records failure explicitly.



## Rules & Invariants

- Key is the episode and the script revision the job started from; a newer revision's job may start while an older one still runs, and starting again for the same revision returns the running job (alreadyRunning).
- Success is judged by SaveRecap succeeding for the job's revision; a save refused because the script moved on fails the job at once, without the usual retry.
- A restart marks a running recap as failed.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `WriteRecap` |
| Emits | `RecapRequested` |
| Emits | `RecapCompleted` |
| Emits | `RecapFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
