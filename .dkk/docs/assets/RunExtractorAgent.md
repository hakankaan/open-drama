# RunExtractorAgent

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [assets](index.md)

## Summary

When an extraction starts, run the extractor agent scoped to the episode with a target-specific instruction (only characters, only scenes, or only plot-critical props) — agents.RunAgent, a cross-context command, see flow AssetStage. The agent reads the script and existing assets, deduplicates and saves through the SaveExtracted* commands.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `ExtractionStarted` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | proposed |
