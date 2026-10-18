# AgentRun

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [agents](index.md)

## Summary

One execution of an agent — resolves instructions and model, runs the tool-calling loop up to the step budget, and reports the tools called and the final text. Success is judged by what the tools persisted, not by the model's reply.



## Rules & Invariants

- Every agent has a fixed scope: drama (story_writer, episode_planner), episode (most), or both (prompt_generator: the episode's context when the run has an episode, the drama's otherwise; adr-0024). The run carries dramaId, and episodeId for an episode run, in its request context; every tool reads scope from there and never from model output. Every tool has a fixed scope too, and a run without an episode is offered its agent's drama tools only: a drama-scoped agent carries no other kind, and an agent of both scopes carries at least one, checked at boot. A run may be cut further to the allowlist its starting service names (a design run: one kind's read and save); every allowlist a service names is checked against the agent's tools at boot, and a run naming a tool the agent lacks is refused (adr-0024).
- Instructions = prompt file (language variant, else base, else built-in default) + all matching skills + language directive.
- The text model is the request override, else the prompt file's model, else the default model of the resolved text service; provider quirks (thinking, temperature, max output tokens) are patched at the transport layer. Every run asks for thinking unless OPEN_DRAMA_AI_DISABLE_THINKING=1 (adr-0006 amendment 2026-10-18).


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
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
