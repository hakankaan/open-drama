# RunRecapWriter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [production](index.md)

## Summary

When a recap is requested, run the recap_writer agent scoped to the episode (agents.RunAgent — a cross-context command, see flow ScriptStage) with the script revision the job started from. The agent reads the script and the SeriesContext and calls SaveRecap; the recap card shows a writing state until the run completes.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `RecapRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
