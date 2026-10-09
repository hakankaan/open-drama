# DeleteModelService

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Remove a service permanently.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `serviceId` | `ID` | — |

## Rules & Invariants

- A generation is running on the service (a restart resumes it with the service's address and key)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `ModelService` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
