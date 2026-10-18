# SaveExtractedCharacters

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Batch upsert from the extractor agent's save_dedup_characters tool. Each entry is matched against the drama by exact or near name; a match gets its empty fields filled and keeps the rest, a name matching only a deleted character or a claimed character is skipped and named, and a new one is created; every entry is linked to the current episode. An entry's outfit dresses an existing character for this episode alone (adr-0023), written only while the episode's outfit for them is empty, so the creator's or an earlier run's is kept; a new or claimed character is not dressed, and the character's own fields never are by the outfit (adr-0024). The reply names who was dressed and whose outfit was kept.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `dramaId` | `ID` | — |
| `characters` | `ExtractedCharacter[]` | name, role, appearance, styling, description, and an optional outfit for this episode |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
