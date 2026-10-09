# CancelAgentJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Stop a running agent job of any kind (rewrite, write, recap, outline, plan, extraction, breakdown, video-prompt batch). The job's abort signal reaches the model call in flight and stops tool execution; the job then settles as cancelled through its failure path, so a breakdown restores its parked shots and a plan keeps the episodes it created. Answers with the job as it is; it settles a moment later.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `jobId` | `ID` | — |

## Rules & Invariants

- The job is running in this process
- Unknown job
- The job is no longer running (already done, failed or cancelled)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
