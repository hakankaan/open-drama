# FailInterruptedTasks

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

At API startup, mark every task still in processing as failed with a restart message, because the in-memory polling loops died with the previous process.





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
