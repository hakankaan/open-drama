# Episode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

One episode of a drama. Holds the raw content and the formatted script with its revision, the recap for the writers of later episodes, the locked image/video services, the pinned video model and the resolution, the target length, the production status and, once merged, the film.



## Rules & Invariants

- episodeNumber is unique among the drama's non-deleted episodes and assigned as max(existing) + 1, inside the transaction that inserts the episode, so a planner batch and a manual Add episode never collide.
- An episode is planned when the planner created it: its description is the synopsis and its raw content the beat sheet. The planner only appends; an episode the creator added keeps its title, status, resolution, target and locks. Deleting a planned episode is the way to reject it.
- The script has one agent at a time: a rewrite (RewriteScript) and a write (WriteEpisodeScript) refuse each other while running, and a breakdown, the skip, the creator's content edit and the creator's script edit are refused while either runs.
- imageServiceId and videoServiceId are each taken from the highest-priority usable model service of the type at creation when one exists, else left empty and written at the first generation of that type (adr-0016); from then on the episode uses that one service per type. Creation needs no image or video service.
- videoModel is empty until the first generation on the locked video service without an explicit model writes the model it used; later generations use it while the service lists it, and move to the service's first model, written back, when it no longer does. An explicit model overrides it for one call (adr-0017).
- beatsRevision increments on every change of the raw content (the beat sheet), whoever writes it; with scriptRevision and recapRevision it is the freshness token an assistant's save must carry (ifRevision).
- An episode that holds a script, shots or a film is deleted only with force; no episode is deleted while one of its jobs runs.
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
| Handles | `AddPlannedEpisodes` |
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
| Emits | `PlannedEpisodesAdded` |
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
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0017](../../adr/adr-0017.md) | Video prompt discipline, seeds and a pinned video model | proposed |
