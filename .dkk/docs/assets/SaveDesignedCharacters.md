# SaveDesignedCharacters

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Bulk save from the asset designer's save_designed_characters tool (adr-0024), the whole designed cast in one call, never empty, every entry with an appearance, capped at 12 (the overflow is named in the reply, not saved, and not retried). Each entry is matched against the drama by exact or near name under the extractor's rules; a match gets its empty fields filled and keeps the rest (its final prompt is marked stale when a field the prompt is written from was filled), a name matching only a deleted character or a character whose image is being made is skipped and named, and a new one is created. Nothing is linked to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `characters` | `ExtractedCharacter[]` | name, role, appearance, styling, description |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
