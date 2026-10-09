# DeleteDrama

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Soft-delete a drama together with its live episodes, characters, scenes and props, all with the drama's deletion timestamp. Shots and generation records remain stored but are hidden with their episode or asset.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |

## Rules & Invariants

- A job of the drama is running (drama-scoped or on one of its episodes): it would go on adding episodes or assets under the deleted drama, so it is cancelled or finishes first


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Drama` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
