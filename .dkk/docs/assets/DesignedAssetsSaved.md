# DesignedAssetsSaved

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

The asset designer saved one kind's set on the drama (adr-0024); reports how many were created, how many existing ones had empty fields filled, which names were skipped (deleted, or under an image claim) and which were over the cap. Recorded on the job's progress, where the Story tab and wait_for_job read it.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `target` | `string` | — |
| `saved` | `number` | — |
| `filled` | `number` | — |
| `skipped` | `string[]` | — |
| `overflow` | `string[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `DesignJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
