# CreateSkill

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [agents](index.md)

## Summary

Create a skill directory with a starter SKILL.md under an agent's prefix.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Path such as storyboard-breaker/custom-pacing |
| `description` | `string` | — |

## Rules & Invariants

- Invalid id segment
- Skill already exists


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `AgentSkill` |

## Linked ADRs

_No linked ADRs._
