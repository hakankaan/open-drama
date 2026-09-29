# EpisodeFilms

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [compositing](index.md)

## Summary

The export stage — the episode's films newest first (status, duration, poster, path for play/download). The stage reads the selectable shots and their generated state from storyboard.EpisodeShotList.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `films` | `FilmRow[]` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `MergeStarted` |
| Subscribes to | `FilmRendered` |
| Subscribes to | `MergeFailed` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
