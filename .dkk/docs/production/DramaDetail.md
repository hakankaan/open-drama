# DramaDetail

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

The project page — the drama with its episodes (number, title, status, resolution, script and film presence) and the drama-wide asset library (characters, scenes, props).


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
| Subscribes to | `EpisodeResolutionChanged` |
| Subscribes to | `EpisodeStatusChanged` |
| Subscribes to | `EpisodeFilmAttached` |
| Subscribes to | `EpisodeDeleted` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
