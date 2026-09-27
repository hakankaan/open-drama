# PollGenerationTask

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

Ask the provider for the status of an asynchronous task according to the type's polling profile; on completion capture the result, on terminal failure fail the task, on budget exhaustion fail with a timeout.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |
| `attempt` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `GenerationTask` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | proposed |
