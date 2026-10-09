# RunEpisodePlanner

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [production](index.md)

## Summary

When an episode plan is requested, run the episode_planner agent scoped to the drama (agents.RunAgent — a cross-context command, see flow StoryDevelopment). The agent reads the outline, the request and every live episode with its state and calls AddPlannedEpisodes in batches; the episodes tab shows the count added of requested until the run completes.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `EpisodePlanRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
