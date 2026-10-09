# RunStoryWriter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [production](index.md)

## Summary

When an outline is requested, run the story_writer agent scoped to the drama (agents.RunAgent — a cross-context command, see flow StoryDevelopment). The agent reads the premise, the existing outline and the state of every live episode and calls SaveOutline; the story tab shows a writing state until the run completes.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `OutlineRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
