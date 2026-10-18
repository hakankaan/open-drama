# RequestSceneImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Generate the scene's reference image. Ensures a final prompt first; the fallback prompt explicitly excludes people. Readiness is derived from the latest image task, not stored on the scene. Without an episode (the project's asset library, adr-0024) the task runs in the explicit service, else the highest-priority active image service, and no episode lock is claimed.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `sceneId` | `ID` | — |
| `episodeId` | `ID` | Optional (adr-0024); with one the task runs in the episode's locked image service, without one in the explicit service, else the highest-priority active one, and no lock is claimed |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |
| `textModel` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- No image model service configured
- An image task for this scene is still processing


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Scene` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
