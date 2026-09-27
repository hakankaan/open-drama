# DramaStats

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

Counts of dramas by status for the launcher hero (total, active, completed).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `total` | `number` | — |
| `byStatus` | `StatusCount[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `DramaCreated` |
| Subscribes to | `DramaUpdated` |
| Subscribes to | `DramaDeleted` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
