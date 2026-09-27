# GenerateSceneFinalPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Run the prompt-generator agent to write the empty establishing-shot final prompt for a scene (force regenerates). Persisted through SaveSceneFinalPrompt.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `sceneId` | `ID` | — |
| `episodeId` | `ID` | — |
| `force` | `boolean` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- Agent finished without saving a prompt


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Scene` |

## Linked ADRs

_No linked ADRs._
