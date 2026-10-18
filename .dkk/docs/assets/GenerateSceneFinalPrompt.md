# GenerateSceneFinalPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Run the prompt-generator agent to write the empty establishing-shot final prompt for a scene (force regenerates). Persisted through SaveSceneFinalPrompt.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `sceneId` | `ID` | — |
| `episodeId` | `ID` | Optional (adr-0024); with one the agent runs in the episode's context, without one in the drama's |
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

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
