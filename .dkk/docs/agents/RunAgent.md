# RunAgent

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [agents](index.md)

## Summary

Run one agent with a user message scoped to an episode and drama. Used by the production, assets and storyboard contexts (rewrite, recap, extraction, breakdown, prompts) and by the debugging chat endpoint.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `agentType` | `string` | script_rewriter | extractor | storyboard_breaker | prompt_generator | recap_writer |
| `message` | `string` | — |
| `episodeId` | `ID` | — |
| `dramaId` | `ID` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |
| `maxSteps` | `number` | — |
| `scriptRevision` | `number` | Recap runs only — the revision SaveRecap pins to |

## Rules & Invariants

- A text model service is resolvable
- Unknown agent type
- No text model service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `AgentRun` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
