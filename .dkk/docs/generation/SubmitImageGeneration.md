# SubmitImageGeneration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [generation](index.md)

## Summary

Create an image generation task for a prompt with optional reference images and canvas size, tagged with its owner (character, scene or prop). Returns the task id at once; processing continues in the background.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `prompt` | `string` | — |
| `dramaId` | `ID` | — |
| `characterId` | `ID` | — |
| `sceneId` | `ID` | — |
| `propId` | `ID` | — |
| `size` | `string` | — |
| `referenceImages` | `string[]` | — |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |

## Rules & Invariants

- Empty prompt
- No image model service resolvable


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `GenerationTask` |

## Linked ADRs

_No linked ADRs._
