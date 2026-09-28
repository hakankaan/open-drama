# AgentPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [agents](index.md)

## Summary

The prompt file of one agent in one language. The base language file also carries the optional model override; variants do not.



## Rules & Invariants

- Only known agent types can have prompt files.
- Resetting deletes the file; the runtime then falls back to the base language file or the built-in default.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `SaveAgentPrompt` |
| Handles | `ResetAgentPrompt` |
| Emits | `AgentPromptSaved` |
| Emits | `AgentPromptReset` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
