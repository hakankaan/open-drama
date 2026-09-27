# Episode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

One episode of a drama. Holds the raw content and the formatted script, the locked image/video services and resolution, the production status and, once merged, the film.



## Rules & Invariants

- episodeNumber is unique among the drama's non-deleted episodes and assigned as max(existing) + 1.
- imageServiceId and videoServiceId are snapshotted at creation from the highest-priority active model service of each type; creation is rejected when either type has no active service.
- resolution is one of 480p, 720p or 1080p and applies to every video generated for the episode; adapters map it to the provider's nearest tier.
- status is one of draft, active or completed (the same vocabulary as Drama); completed is a manual mark set from the export stage and can be undone.
- scriptContent is the single script used downstream. RewriteScript fills it through SaveScript; SkipRewrite copies the raw content into it, so a skip is persisted and survives reloads.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateEpisode` |
| Handles | `UpdateEpisodeContent` |
| Handles | `SaveScript` |
| Handles | `SkipRewrite` |
| Handles | `SetEpisodeResolution` |
| Handles | `SetEpisodeStatus` |
| Handles | `AttachEpisodeFilm` |
| Handles | `DeleteEpisode` |
| Emits | `EpisodeCreated` |
| Emits | `EpisodeContentUpdated` |
| Emits | `ScriptSaved` |
| Emits | `ScriptRewriteSkipped` |
| Emits | `EpisodeResolutionChanged` |
| Emits | `EpisodeStatusChanged` |
| Emits | `EpisodeFilmAttached` |
| Emits | `EpisodeDeleted` |

## Linked ADRs

_No linked ADRs._
