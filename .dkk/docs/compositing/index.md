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
| [MergeShots](MergeShots.md) | Render a film from the episode's shots that have videos (all of them, or the given shot ids). Checks FFmpeg availability and clip existence, creates the merge record and starts rendering in the background. With colour match on, each clip is nudged towards the keyframe it started from, else its shot's keyframe. A clip that continues the clip before it in the film (adr-0020) joins it without a cut and takes its grade; one that continued a version not in the film is matched to its shot's keyframe only; a lip sync counts as the take it was synced from (adr-0021). The film's encoder line records how many clips were matched and joined. | `Creator` | `Film` | episodeId (ID), shotIds (ID[]), colorMatch (boolean) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [DerivePosterForFilm](DerivePosterForFilm.md) | When a film is rendered, extract a poster frame (media.DeriveRenditions — cross-context) so the film list shows a cover without buffering the video. | FilmRendered | — |
| [PublishFilmToEpisode](PublishFilmToEpisode.md) | When a film is rendered, attach it to the episode as its current video (production.AttachEpisodeFilm — cross-context, see flow MergeAndExport). | FilmRendered | — |
| [RunFfmpegConcat](RunFfmpegConcat.md) | When a merge starts, probe every clip, run FFmpeg's concat filter into the merged media directory (each clip graded towards its keyframe when colour match is on — half the way, bounded — then fitted into the drama's frame at the episode's resolution, or the first clip's for an adaptive drama, at 24 fps, letterboxed, cut to the length it was generated at when the provider returned a few frames more, with a stereo track trimmed to that length or silence when it has none; a clip that continues the one before it, from the same video, joins it on the frame it started from: the one before ends on that frame, the continuing clip starts a frame in and takes its grade, adr-0020; the drama's series look over the joined picture), level the mix to -16 LUFS with two-pass loudnorm, re-encode to H.264/AAC with faststart, probe the film's duration, then complete or fail the merge. | MergeStarted | CompleteMerge, FailMerge |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [Film](Film.md) | A rendered episode film and the merge job that produced it — which shot clips were included, the encoder settings, status, output path, duration and poster. | MergeShots, CompleteMerge, FailMerge | MergeStarted, FilmRendered, MergeFailed |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [EpisodeFilms](EpisodeFilms.md) | The export stage — the episode's films newest first (status, duration, poster, path for play/download). The stage reads the selectable shots and their generated state from storyboard.EpisodeShotList. | MergeStarted, FilmRendered, MergeFailed | Creator |
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
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0020](../../adr/adr-0020.md) | Continuous takes between shots | proposed |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
