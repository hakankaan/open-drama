# SubmitAssetImageGeneration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [assets](index.md)

## Summary

When an asset image is requested, submit an image generation task tagged with the asset id (generation.SubmitImageGeneration — cross-context, see flow AssetStage). A character's headshot uses a square canvas and its other views 9:16 with the headshot as reference image; props a square canvas, scenes the drama's aspect ratio.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `CharacterImageRequested` |
| Triggered by | `SceneImageRequested` |
| Triggered by | `PropImageRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0018](../../adr/adr-0018.md) | Character reference views | accepted |
