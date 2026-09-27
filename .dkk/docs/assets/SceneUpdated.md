# SceneUpdated

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

The asset's fields changed; if description or lighting changed, finalPromptStale is now true.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `sceneId` | `ID` | — |
| `changedFields` | `string[]` | — |
| `finalPromptStale` | `boolean` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Scene` |

## Linked ADRs

_No linked ADRs._
