# production

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

Dramas (projects) and their episodes — the production lifecycle from raw source text to a finished episode film. Owns the per-episode stage rail (script → assets → video production → export) that the studio shows.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Raw content** | The source text the creator pastes (novel chapter, outline, shot list) before any rewrite. | — |
| **Formatted script** | The rewritten shooting script — scene headings (## S01 | INT/EXT · Location | Time), action paragraphs and dialogue lines, with no camera language. | Script |
| **Stage rail** | The per-episode progress indicator. It is derived from data (script present, assets ready, shots with videos, film rendered, status completed), never stored directly. | — |
| **Locked generation config** | The image and video model service ids snapshotted onto an episode at creation so later provider changes do not silently alter an in-progress episode. Falls back to the active service if the locked one is disabled. | — |
| **Project** | The creator-facing name for a Drama aggregate — a short-drama project that fixes aspect ratio and visual style and owns episodes and shared assets. | Drama project |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [DramaCreated](DramaCreated.md) | A new drama project exists with its fixed aspect ratio and chosen visual style. | `Drama` | dramaId (ID), title (string), aspectRatio (string), style (string) |
| [DramaDeleted](DramaDeleted.md) | A drama was soft-deleted and disappears from every listing. | `Drama` | dramaId (ID) |
| [DramaUpdated](DramaUpdated.md) | A drama's editable attributes (title, description, genre, style, status, tags) changed. | `Drama` | dramaId (ID), changedFields (string[]) |
| [EpisodeContentUpdated](EpisodeContentUpdated.md) | The creator saved edits to the raw content, script, title or description of an episode. | `Episode` | episodeId (ID), changedFields (string[]) |
| [EpisodeCreated](EpisodeCreated.md) | A new episode was added to a drama with its number, resolution and locked image/video services. | `Episode` | episodeId (ID), dramaId (ID), episodeNumber (number), resolution (string), imageServiceId (ID), videoServiceId (ID) |
| [EpisodeDeleted](EpisodeDeleted.md) | An episode was soft-deleted and is hidden from the drama. | `Episode` | episodeId (ID), dramaId (ID) |
| [EpisodeFilmAttached](EpisodeFilmAttached.md) | A rendered film became the episode's current video; the export stage can show and download it. | `Episode` | episodeId (ID), filmPath (string), durationSeconds (number) |
| [EpisodeResolutionChanged](EpisodeResolutionChanged.md) | The episode's video resolution tier changed; subsequent video generations use the new tier. | `Episode` | episodeId (ID), resolution (string) |
| [EpisodeStatusChanged](EpisodeStatusChanged.md) | The episode's production status moved between draft, active and completed. | `Episode` | episodeId (ID), status (string) |
| [ScriptRewriteCompleted](ScriptRewriteCompleted.md) | The rewrite agent run finished and a script was saved; the script stage is done. | `ScriptRewriteJob` | episodeId (ID), jobId (ID) |
| [ScriptRewriteFailed](ScriptRewriteFailed.md) | The rewrite agent failed, finished without saving, or was interrupted by a restart; the error is shown and the creator can retry or skip. | `ScriptRewriteJob` | episodeId (ID), jobId (ID), error (string) |
| [ScriptRewriteRequested](ScriptRewriteRequested.md) | The creator asked for an AI rewrite of the episode's raw content; the script-rewriter agent should run. | `ScriptRewriteJob` | episodeId (ID), dramaId (ID), model (string), textServiceId (ID) |
| [ScriptRewriteSkipped](ScriptRewriteSkipped.md) | The creator chose to use the raw content directly instead of an AI rewrite. | `Episode` | episodeId (ID) |
| [ScriptSaved](ScriptSaved.md) | A formatted script was persisted for the episode (by the rewriter agent). The script stage is now done and extraction can start. | `Episode` | episodeId (ID), characterCount (number) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [AttachEpisodeFilm](AttachEpisodeFilm.md) | Record the latest rendered film as the episode's video. Issued by the compositing context when a merge completes. | `RenderWorker` | `Episode` | episodeId (ID), filmPath (string), durationSeconds (number) |
| [CreateDrama](CreateDrama.md) | Create a new drama project with a title, an aspect ratio and a visual style. No episodes are pre-created; the creator adds them from the project page. | `Creator` | `Drama` | title (string), description (string), genre (string), style (string), aspectRatio (string), tags (string[]) |
| [CreateEpisode](CreateEpisode.md) | Add the next episode to a drama. Assigns the next episode number, defaults the title, fixes the video resolution and locks the image and video model services that will be used for this episode. | `Creator` | `Episode` | dramaId (ID), title (string), resolution (string), imageServiceId (ID), videoServiceId (ID) |
| [DeleteDrama](DeleteDrama.md) | Soft-delete a drama. Its episodes, assets, shots and generation records remain stored but are hidden everywhere. | `Creator` | `Drama` | dramaId (ID) |
| [DeleteEpisode](DeleteEpisode.md) | Soft-delete an episode. Its shots and generation records are kept but no longer reachable; later episodes keep their numbers. | `Creator` | `Episode` | episodeId (ID) |
| [RewriteScript](RewriteScript.md) | Ask the script-rewriter agent to turn the episode's raw content into a formatted script. The agent reads the content and persists its result through SaveScript; the creator may pick a text model or service for this run. | `Creator` | `ScriptRewriteJob` | episodeId (ID), model (string), textServiceId (ID) |
| [SaveScript](SaveScript.md) | Persist the formatted script produced by the script-rewriter agent (its save_script tool). Replaces the previous formatted script. | `AgentRuntime` | `Episode` | episodeId (ID), scriptContent (string) |
| [SetEpisodeResolution](SetEpisodeResolution.md) | Change the resolution used for every video generated in this episode (480p, 720p, 1080p). Adapters map it to the nearest provider tier. | `Creator` | `Episode` | episodeId (ID), resolution (string) |
| [SetEpisodeStatus](SetEpisodeStatus.md) | Set the episode's production status (draft, active, completed — the same enum as Drama). "Mark done" on the export stage sets completed; clicking again reverts to active. | `Creator` | `Episode` | episodeId (ID), status (string) |
| [SkipRewrite](SkipRewrite.md) | Skip the AI rewrite by copying the raw content into scriptContent, so extraction and storyboard breakdown use it and the skip is persisted (the stage rail shows the script as done after a reload). | `Creator` | `Episode` | episodeId (ID) |
| [UpdateDrama](UpdateDrama.md) | Update a drama's title, description, genre, style, status or tags. The aspect ratio is immutable and is ignored if supplied. | `Creator` | `Drama` | dramaId (ID), title (string), description (string), genre (string), style (string), status (string), tags (string[]) |
| [UpdateEpisodeContent](UpdateEpisodeContent.md) | Save the creator's edits to an episode's raw content, formatted script, title or description. Used by the script workbench autosave. | `Creator` | `Episode` | episodeId (ID), content (string), scriptContent (string), title (string), description (string) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [RunScriptRewriter](RunScriptRewriter.md) | When a script rewrite is requested, run the script_rewriter agent scoped to the episode (agents.RunAgent — a cross-context command, see flow ScriptStage). The agent reads the raw content and calls SaveScript; the creator's UI shows a rewriting state until the run completes. | ScriptRewriteRequested | — |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [Drama](Drama.md) | A short-drama project — the root under which episodes, characters, scenes and props live. Fixes the aspect ratio and the visual style used by every image and video prompt. | CreateDrama, UpdateDrama, DeleteDrama | DramaCreated, DramaUpdated, DramaDeleted |
| [Episode](Episode.md) | One episode of a drama. Holds the raw content and the formatted script, the locked image/video services and resolution, the production status and, once merged, the film. | CreateEpisode, UpdateEpisodeContent, SaveScript, SkipRewrite, SetEpisodeResolution, SetEpisodeStatus, AttachEpisodeFilm, DeleteEpisode | EpisodeCreated, EpisodeContentUpdated, ScriptSaved, ScriptRewriteSkipped, EpisodeResolutionChanged, EpisodeStatusChanged, EpisodeFilmAttached, EpisodeDeleted |
| [ScriptRewriteJob](ScriptRewriteJob.md) | A running AI rewrite for an episode. Wraps the script_rewriter agent run so the studio can poll it, and records failure explicitly; at most one per episode at a time. | RewriteScript | ScriptRewriteRequested, ScriptRewriteCompleted, ScriptRewriteFailed |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [DramaDetail](DramaDetail.md) | The project page — the drama with its episodes (number, title, status, resolution, script and film presence) and the drama-wide asset library (characters, scenes, props). | DramaUpdated, EpisodeCreated, EpisodeContentUpdated, ScriptSaved, EpisodeResolutionChanged, EpisodeStatusChanged, EpisodeFilmAttached, EpisodeDeleted | Creator |
| [DramaList](DramaList.md) | The project launcher — every non-deleted drama with its status, aspect ratio, style, counts of episodes, characters and scenes, and last update time. Supports search by title, status filter and sort by updated or title. | DramaCreated, DramaUpdated, DramaDeleted, EpisodeCreated, EpisodeDeleted | Creator |
| [DramaStats](DramaStats.md) | Counts of dramas by status for the launcher hero (total, active, completed). | DramaCreated, DramaUpdated, DramaDeleted | Creator |
| [EpisodeJobs](EpisodeJobs.md) | The latest job per kind for an episode — rewrite, extraction per target, storyboard breakdown and video-prompt batch — with status (running / done / failed), progress and error, so the studio polls one endpoint while anything runs. Extraction, breakdown and prompt-batch jobs are owned by the assets and storyboard contexts; this projection reads their rows. | ScriptRewriteRequested, ScriptRewriteCompleted, ScriptRewriteFailed | Creator |
| [EpisodePipelineStatus](EpisodePipelineStatus.md) | The stage rail for one episode, derived on read. Script is ready when raw content exists and done when scriptContent exists (rewritten or copied by SkipRewrite); assets report ready/total per type; storyboard reports shot count; videos report shots with a video over total; export reports the latest merge status and film path; completed reflects the manual mark. | EpisodeContentUpdated, ScriptSaved, ScriptRewriteSkipped, EpisodeStatusChanged, EpisodeFilmAttached | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | proposed |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | proposed |
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | proposed |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | proposed |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | proposed |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
