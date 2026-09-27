# StartExtraction

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Start an asynchronous extraction of one target type (characters, scenes or props) from the episode's script. Returns immediately; the UI polls the job. Optionally overrides the text model or service for the run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `target` | `string` | characters | scenes | props |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- The episode has a script (formatted or raw)
- Unknown target
- Episode has no script


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `ExtractionJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | proposed |
