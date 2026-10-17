# AttachAssetImageOnGeneration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [assets](index.md)

## Summary

Triggered by generation.ImageGenerated (a cross-context event, see flow AssetStage) for a task tagged with a character, scene or prop — writes the local image path onto that asset (a character's onto the view the task names), and for a character requests the next view of its chain. A task drawn for an episode outfit lands on that episode link instead, only while the outfit is unchanged (adr-0023). Failures leave the asset unchanged and are visible on the task.





## Relationships

| Relationship | Target |
|-------------|--------|
| Emits | `UpdateCharacter` |
| Emits | `UpdateScene` |
| Emits | `UpdateProp` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0018](../../adr/adr-0018.md) | Character reference views | accepted |
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
