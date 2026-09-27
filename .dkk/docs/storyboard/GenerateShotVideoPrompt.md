# GenerateShotVideoPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Run the prompt-generator agent for a single shot to write its video prompt from the description (sub-shots and dialogue), atmosphere and duration, then persist it via the agent's update_shot tool (only shotId and videoPrompt).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- Agent finished without saving a prompt


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

_No linked ADRs._
