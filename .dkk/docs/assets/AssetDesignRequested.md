# AssetDesignRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

A design job for one kind began on the drama (adr-0024), from the outline at the recorded revision.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `target` | `string` | — |
| `outlineRevision` | `number` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `DesignJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
