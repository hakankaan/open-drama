# DispatchGenerationTask

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

Normalise the task's reference material, build the provider request through the adapter, send it, and record either a synchronous result or the provider task id to poll.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `taskId` | `ID` | — |

## Rules & Invariants

- Unsupported provider for the task type
- Local reference video or audio without a public base URL
- Provider rejected the request (HTTP error)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `GenerationTask` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
