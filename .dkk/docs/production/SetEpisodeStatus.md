# SetEpisodeStatus

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Set the episode's production status (draft, active, completed — the same enum as Drama). "Mark done" on the export stage sets completed; clicking again reverts to active.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `status` | `string` | — |

## Rules & Invariants

- Unknown status value


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
