# DramaDetail

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

The project page — the drama (with its serial flag) with its episodes (number, title, status, resolution, script, film and recap presence, recap staleness) and the drama-wide asset library (characters, scenes, props). The studio counts the earlier episodes' ready, stale and missing recaps from it before a rewrite.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `episodes` | `EpisodeSummary[]` | — |
| `characters` | `CharacterSummary[]` | — |
| `scenes` | `SceneSummary[]` | — |
| `props` | `PropSummary[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `DramaUpdated` |
| Subscribes to | `EpisodeCreated` |
| Subscribes to | `EpisodeContentUpdated` |
| Subscribes to | `ScriptSaved` |
| Subscribes to | `ScriptRewriteSkipped` |
| Subscribes to | `RecapSaved` |
| Subscribes to | `EpisodeResolutionChanged` |
| Subscribes to | `EpisodeStatusChanged` |
| Subscribes to | `EpisodeFilmAttached` |
| Subscribes to | `EpisodeDeleted` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
