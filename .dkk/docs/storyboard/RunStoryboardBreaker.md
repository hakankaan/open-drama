# RunStoryboardBreaker

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [storyboard](index.md)

## Summary

When a breakdown is requested, run the storyboard_breaker agent scoped to the episode (agents.RunAgent — cross-context, see flow StoryboardAndVideoStage); it reads script and assets and saves shots in batches through SaveShots.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `StoryboardBreakdownRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
