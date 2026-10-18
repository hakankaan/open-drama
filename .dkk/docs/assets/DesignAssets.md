# DesignAssets

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Start the asset designer on the whole drama for one kind (characters, scenes or props), from the story outline (adr-0024). Returns at once; the Story tab polls the job. The studio starts the three kinds together, and the three run in parallel. Optionally overrides the text model or service for the run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `target` | `string` | characters | scenes | props |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- The drama has a story outline
- No outline job is running for the drama
- Unknown target
- No outline yet (412, write the outline first)
- The outline is being written (409)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `DesignJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
