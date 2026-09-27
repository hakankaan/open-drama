# AgentRun

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [agents](index.md)

## Summary

One execution of an agent — resolves instructions and model, runs the tool-calling loop up to the step budget, and reports the tools called and the final text. Success is judged by what the tools persisted, not by the model's reply.



## Rules & Invariants

- The run carries episodeId and dramaId in its request context; every tool reads scope from there and never from model output.
- Instructions = prompt file (language variant, else base, else built-in default) + all matching skills + language directive.
- The text model is the request override, else the prompt file's model, else the default model of the resolved text service; provider quirks (thinking off on relays, temperature, max output tokens) are patched at the transport layer.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `RunAgent` |
| Emits | `AgentRunStarted` |
| Emits | `AgentRunCompleted` |
| Emits | `AgentRunFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | proposed |
