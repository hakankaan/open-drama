# AssetDesignFailed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

The asset designer run failed or was cancelled for the kind; whatever its save had written stays.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `target` | `string` | — |
| `error` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `DesignJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
