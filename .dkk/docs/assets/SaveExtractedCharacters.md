# SaveExtractedCharacters

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Batch upsert from the extractor agent's save_dedup_characters tool. Each entry is matched against the drama by exact or near name; matches are merged (new non-empty fields win) and new ones created; every entry is linked to the current episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `dramaId` | `ID` | — |
| `characters` | `ExtractedCharacter[]` | name, role, appearance, styling, description |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Character` |

## Linked ADRs

_No linked ADRs._
