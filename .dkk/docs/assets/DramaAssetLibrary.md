# DramaAssetLibrary

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [assets](index.md)

## Summary

The drama-wide asset library tab on the project page — every character, scene and prop of the drama regardless of episode, with image, final prompt and edit/generate affordances.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `characters` | `CharacterCard[]` | — |
| `scenes` | `SceneCard[]` | — |
| `props` | `PropCard[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `CharacterCreated` |
| Subscribes to | `CharacterUpdated` |
| Subscribes to | `CharacterDeleted` |
| Subscribes to | `SceneCreated` |
| Subscribes to | `SceneUpdated` |
| Subscribes to | `SceneDeleted` |
| Subscribes to | `PropCreated` |
| Subscribes to | `PropUpdated` |
| Subscribes to | `PropDeleted` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
