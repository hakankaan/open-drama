# compositing

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

Turning an episode's shot videos into a film. The creator selects shots, the render worker concatenates them in shot order with FFmpeg, and the resulting film is attached to the episode for playback and download.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Merge** | The asynchronous render job that produces a film; tracked with processing / completed / failed. | Final cut, Export |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [FilmRendered](FilmRendered.md) | The film was rendered to local media with a known duration; it should get a poster and become the episode's video. | `Film` | mergeId (ID), episodeId (ID), filmPath (string), durationSeconds (number) |
| [MergeFailed](MergeFailed.md) | Rendering failed; the error is shown on the export stage and the creator can retry. | `Film` | mergeId (ID), episodeId (ID), error (string) |
| [MergeStarted](MergeStarted.md) | A merge record exists in processing state with the ordered list of clips to concatenate. | `Film` | mergeId (ID), episodeId (ID), clipPaths (string[]) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [CompleteMerge](CompleteMerge.md) | Record the rendered output path and probed duration on the merge and mark it completed. | `RenderWorker` | `Film` | mergeId (ID), filmPath (string), durationSeconds (number) |
| [FailMerge](FailMerge.md) | Mark the merge failed with the FFmpeg error. | `RenderWorker` | `Film` | mergeId (ID), error (string) |
| [MergeShots](MergeShots.md) | Render a film from the episode's shots that have videos (all of them, or the given shot ids). Checks FFmpeg availability and clip existence, creates the merge record and starts rendering in the background. | `Creator` | `Film` | episodeId (ID), shotIds (ID[]) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [DerivePosterForFilm](DerivePosterForFilm.md) | When a film is rendered, extract a poster frame (media.DeriveRenditions — cross-context) so the film list shows a cover without buffering the video. | FilmRendered | — |
| [PublishFilmToEpisode](PublishFilmToEpisode.md) | When a film is rendered, attach it to the episode as its current video (production.AttachEpisodeFilm — cross-context, see flow MergeAndExport). | FilmRendered | — |
| [RunFfmpegConcat](RunFfmpegConcat.md) | When a merge starts, write the concat list, run FFmpeg (concat demuxer, re-encode to H.264/AAC, faststart) into the merged media directory, probe the duration, then complete or fail the merge. | MergeStarted | CompleteMerge, FailMerge |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [Film](Film.md) | A rendered episode film and the merge job that produced it — which shot clips were included, the encoder settings, status, output path, duration and poster. | MergeShots, CompleteMerge, FailMerge | MergeStarted, FilmRendered, MergeFailed |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [EpisodeFilms](EpisodeFilms.md) | The export stage — the episode's films newest first (status, duration, poster, path for play/download) and the shot assets available for selection with their generated state. | MergeStarted, FilmRendered, MergeFailed | Creator |
| [LatestMergeStatus](LatestMergeStatus.md) | The most recent merge of an episode for polling while rendering (status, film path, duration, error). | MergeStarted, FilmRendered, MergeFailed | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | accepted |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | accepted |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | accepted |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
