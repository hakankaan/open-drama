# AttachAssetImageOnGeneration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [assets](index.md)

## Summary

Triggered by generation.ImageGenerated (a cross-context event, see flow AssetStage) for a task tagged with a character, scene or prop — writes the local image path onto that asset. Failures leave the asset unchanged and are visible on the task.





## Relationships

| Relationship | Target |
|-------------|--------|
| Emits | `UpdateCharacter` |
| Emits | `UpdateScene` |
| Emits | `UpdateProp` |

## Linked ADRs

_No linked ADRs._
