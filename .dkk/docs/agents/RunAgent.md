# RunAgent

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [agents](index.md)

## Summary

Run one agent with a user message scoped to a drama and, for an episode-scoped agent, to an episode of it. Used by the production, assets and storyboard contexts (outline, plan, write, rewrite, recap, extraction, breakdown, prompts) and by the debugging chat endpoint.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `agentType` | `string` | script_rewriter | extractor | storyboard_breaker | prompt_generator | recap_writer | story_writer | episode_planner | episode_writer |
| `message` | `string` | — |
| `episodeId` | `ID` | Required for an episode-scoped agent, absent for a drama-scoped one |
| `dramaId` | `ID` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |
| `maxSteps` | `number` | — |
| `scriptRevision` | `number` | Recap runs only — the revision SaveRecap pins to |

## Rules & Invariants

- A text model service is resolvable
- Unknown agent type
- An episode-scoped agent without an episode, or an episode of another drama
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
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
