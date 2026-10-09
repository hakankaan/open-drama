# RunEpisodeWriter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [production](index.md)

## Summary

When an episode write is requested, run the episode_writer agent scoped to the episode (agents.RunAgent — a cross-context command, see flow StoryDevelopment). The agent reads the beat sheet, the SeriesContext (premise, outline, earlier recaps) and the next episode's beats and calls SaveScript; the script stage shows a writing state until the run completes.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `EpisodeWriteRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
