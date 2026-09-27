# StartVideoPromptBatch

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Start filling video prompts for every shot that lacks one, or regenerate the given shot ids. Runs shot by shot in the background; the UI polls progress. Returns the running job (alreadyRunning) if one exists.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `shotIds` | `ID[]` | Optional; when given, regenerates exactly these |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- Nothing to generate


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `VideoPromptBatch` |

## Linked ADRs

_No linked ADRs._
