# EpisodeAssets

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [assets](index.md)

## Summary

The assets stage of the workbench — characters, scenes and props linked to the episode with their fields, final prompt, reference image (plus thumbnail), readiness (ready / generating / pending) and the extraction job status per type; each character also carries its outfit in the episode, the outfit picture and the latest outfit task (adr-0023).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `characters` | `EpisodeCharacterCard[]` | — |
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
| Subscribes to | `EpisodeOutfitSet` |
| Subscribes to | `OutfitImageAttached` |
| Subscribes to | `SceneImageAttached` |
| Subscribes to | `PropImageAttached` |
| Subscribes to | `ExtractionStarted` |
| Subscribes to | `ExtractionCompleted` |
| Subscribes to | `ExtractionFailed` |
| Used by | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
