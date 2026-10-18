# CreateScene

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Manually add a scene (location, time, description, lighting) to a drama, optionally linking it to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `episodeId` | `ID` | — |
| `location` | `string` | — |
| `time` | `string` | — |
| `prompt` | `string` | Set-dressing description |
| `lighting` | `string` | — |

## Rules & Invariants

- Empty location


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Scene` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
