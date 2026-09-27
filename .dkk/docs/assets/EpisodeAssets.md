# EpisodeAssets

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [assets](index.md)

## Summary

The assets stage of the workbench — characters, scenes and props linked to the episode with their fields, final prompt, reference image (plus thumbnail), readiness (ready / generating / pending) and the extraction job status per type.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `characters` | `CharacterCard[]` | — |
| `scenes` | `SceneCard[]` | — |
| `props` | `PropCard[]` | — |
| `extraction` | `ExtractionStatusByTarget` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `CharactersExtracted` |
| Subscribes to | `ScenesExtracted` |
| Subscribes to | `PropsExtracted` |
| Subscribes to | `CharacterUpdated` |
| Subscribes to | `SceneUpdated` |
| Subscribes to | `PropUpdated` |
| Subscribes to | `CharacterImageAttached` |
| Subscribes to | `SceneImageAttached` |
| Subscribes to | `PropImageAttached` |
| Subscribes to | `ExtractionStarted` |
| Subscribes to | `ExtractionCompleted` |
| Subscribes to | `ExtractionFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
