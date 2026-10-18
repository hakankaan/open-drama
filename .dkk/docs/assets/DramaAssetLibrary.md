# DramaAssetLibrary

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [assets](index.md)

## Summary

The drama-wide asset library tab on the project page — every character, scene and prop of the drama regardless of episode, with image, final prompt and edit/generate/delete affordances. Prompts and images are generated from here without an episode, in the project's image service (adr-0024), so a cast can be drawn before episode 1.


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

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
