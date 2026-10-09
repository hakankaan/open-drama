# ResumeInterruptedTasks

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

At API startup, poll again every task the provider had accepted before the restart (it is already paid for), using its service's address and key. A task whose service was removed, lost its key or now names another provider fails instead. The poll budget runs from the task's submission, so restarts never extend it; the result reaches its owner only if the owner still exists.



## Rules & Invariants

- The task is processing and has a provider task id
- Its service exists, has a key and still names the task's provider


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Bootstrap` |
| Handled by | `GenerationTask` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
