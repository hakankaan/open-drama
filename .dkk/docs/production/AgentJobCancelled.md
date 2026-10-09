# AgentJobCancelled

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [production](index.md)

## Summary

A running agent job was stopped by the creator and settled with status cancelled. Whatever its agent had not saved is discarded; what it saved stays, as after a failure.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `ID` | — |
| `kind` | `string` | — |

## Rules & Invariants

- A job settles once; whichever of finishing, failing or cancelling settles it first wins


## Relationships

_No relationships._

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
