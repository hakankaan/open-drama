# SaveScript

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist the formatted script produced by the script-rewriter agent (its save_script tool). Replaces the previous formatted script.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `scriptContent` | `string` | — |

## Rules & Invariants

- Empty script


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
