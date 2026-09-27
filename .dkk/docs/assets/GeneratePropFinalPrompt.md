# GeneratePropFinalPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Run the prompt-generator agent to write the white-background product-shot final prompt for a prop (force regenerates). Persisted through SavePropFinalPrompt.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `propId` | `ID` | — |
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
| Handled by | `Prop` |

## Linked ADRs

_No linked ADRs._
