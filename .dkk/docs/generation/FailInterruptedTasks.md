# FailInterruptedTasks

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

At API startup, mark as failed every processing task the provider never confirmed (no provider task id), because its submission died with the previous process, and with stub providers every processing task. A task without a provider task id may already have been sent, so its error says the provider may still have run and billed it. Accepted tasks are resumed instead (ResumeInterruptedTasks).





## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Bootstrap` |
| Handled by | `GenerationTask` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
