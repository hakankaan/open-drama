# RunVideoPromptGenerator

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [storyboard](index.md)

## Summary

When a prompt batch starts, run the prompt_generator agent once per shot in shot order (agents.RunAgent — cross-context), telling it the episode's video model, and count success by the persisted prompt.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `VideoPromptBatchStarted` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | proposed |
