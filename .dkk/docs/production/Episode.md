# Episode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

One episode of a drama. Holds the raw content and the formatted script with its revision, the recap for the writers of later episodes, the locked image/video services and resolution, the target length, the production status and, once merged, the film.



## Rules & Invariants

- episodeNumber is unique among the drama's non-deleted episodes and assigned as max(existing) + 1.
- imageServiceId and videoServiceId are snapshotted at creation from the highest-priority active model service of each type; creation is rejected when either type has no active service.
- resolution is one of 480p, 720p or 1080p and applies to every video generated for the episode; adapters map it to the provider's nearest tier.
- targetDurationSeconds is null (the storyboard follows the script) or a whole number of seconds from 10 to 600. The script rewrite is told to write what fits it, and a breakdown is held to it (StoryboardBreakdown). durationSeconds stays the sum of the live shots' durations.
- status is one of draft, active or completed (the same vocabulary as Drama); completed is a manual mark set from the export stage and can be undone.
- scriptContent is the single script used downstream. RewriteScript fills it through SaveScript; SkipRewrite copies the raw content into it, so a skip is persisted and survives reloads.
- scriptRevision increments on every change of scriptContent, whoever writes it; a save of identical text does not move it.
- recap is at most 2000 characters, written by the recap writer for one script revision or edited by the creator, who pins it to the current revision. A recap is stale when its revision is not the script's; staleness is derived, never stored.
- An agent save of a recap for an older script revision is refused; the newer revision has its own recap job.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateEpisode` |
| Handles | `UpdateEpisodeContent` |
| Handles | `SaveScript` |
| Handles | `SkipRewrite` |
| Handles | `SaveRecap` |
| Handles | `SetEpisodeResolution` |
| Handles | `SetEpisodeTargetDuration` |
| Handles | `SetEpisodeStatus` |
| Handles | `AttachEpisodeFilm` |
| Handles | `DeleteEpisode` |
| Emits | `EpisodeCreated` |
| Emits | `EpisodeContentUpdated` |
| Emits | `ScriptSaved` |
| Emits | `ScriptRewriteSkipped` |
| Emits | `RecapSaved` |
| Emits | `EpisodeResolutionChanged` |
| Emits | `EpisodeTargetDurationChanged` |
| Emits | `EpisodeStatusChanged` |
| Emits | `EpisodeFilmAttached` |
| Emits | `EpisodeDeleted` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
