# SaveAgentPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [agents](index.md)

## Summary

Write an agent's prompt file for a language (name, model override for the base language, and the system prompt body).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `agentType` | `string` | — |
| `language` | `string` | — |
| `name` | `string` | — |
| `model` | `string` | — |
| `systemPrompt` | `string` | — |

## Rules & Invariants

- Unknown agent type
- Empty system prompt


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `AgentPrompt` |

## Linked ADRs

_No linked ADRs._
