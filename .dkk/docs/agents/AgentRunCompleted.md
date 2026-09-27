# AgentRunCompleted

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [agents](index.md)

## Summary

The loop ended normally; lists the tools called and the final text. Callers verify the expected side effect (script saved, prompt persisted) separately.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `runId` | `ID` | — |
| `agentType` | `string` | — |
| `toolCalls` | `string[]` | — |
| `steps` | `number` | — |
| `elapsedSeconds` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `AgentRun` |

## Linked ADRs

_No linked ADRs._
