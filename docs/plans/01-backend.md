# Plan 1 — Backend platform (Node.js API)

Scope: the monorepo skeleton, the API server, the database, the shared contract, the endpoints for every bounded context, media storage, background-job infrastructure, FFmpeg compositing, and deployment. The internals of the AI pipeline (agent runtime, prompts/skills workspace, provider adapters, the generation engine) are Plan 2; the web app is Plan 3. This plan defines the interfaces those two plug into.

Governing decisions: `adr-0001` (product scope, original work), `adr-0012` (licence), `adr-0013` (provider set), `adr-0002` (monorepo, Next.js + Node), `adr-0003` (Hono on Node), `adr-0004` (SQLite + Drizzle), `adr-0007` (contract), `adr-0008` (jobs), `adr-0009` (media), `adr-0010` (topology). Run `dkk adr decisions context.<name>` before touching a context.

Domain model: `.dkk/domain/contexts/*` — every endpoint below implements a command or a read model there, and the names are kept identical so the model stays the source of truth.

---

## 1. Goals

1. A single `pnpm dev` that starts the API on `:4000` and the web app on `:3000`, with zero configuration and no external services.
2. An API that implements every command and read model of the eight contexts with the same names and semantics as the domain model.
3. All long-running work (agent runs, generation, merges) is observable through the database and survives a process restart in a well-defined state (`adr-0008`).
4. One data directory holds everything (SQLite file, media, writable workspace), so backup and migration are `cp -r`.
5. Deployable as a Docker image and as two plain Node processes.

Non-goals for this plan: the Electron desktop shell, in-app self-update, shot frame images (first/last frame stills). They are noted under "Later".

## 2. Behaviour to guarantee


- Project → episodes → four stages, with the stage rail derived from data, never stored.
- Episode creation locks the active image and video services and the resolution.
- Assets are drama-wide and linked to episodes; extraction deduplicates by near-name / location+time.
- Shots are upserted by shot number in batches; bindings are validated against the drama and auto-linked to the episode.
- Every generation is a task row with `processing | completed | failed`; interrupted tasks are failed at boot.
- Results are downloaded into local storage with thumbnails/posters; provider URLs are never the source of truth.
- Merge validates FFmpeg and clip existence up front, concatenates in shot order, re-encodes H.264/AAC faststart, probes the duration, extracts a poster, and attaches the film to the episode.
- Model services, style presets and app settings live in the database; the readiness banner is derived from active services per type.
- Style prompt fragment is prepended to every image and video prompt; built-in presets are seeded and upgraded only if unedited.
- Skipping the rewrite copies the raw content into the script so the skip is persisted.
- Starting an extraction or prompt batch that is already running returns the running job instead of an error.

Key design choices (each recorded in an ADR where noted):

| Choice | Why |
|---|---|
| camelCase wire format, `{ data }` / `{ error }` envelope, zod-validated, one enum table (`adr-0007`) | shared types end to end, no manual case mapping |
| extraction / breakdown / prompt-batch status in an `agent_jobs` table behind one `EpisodeJobs` endpoint (`adr-0008`) | survives restarts, one polling endpoint |
| a re-breakdown parks the old shots under the job id and restores them on failure (`adr-0008`) | a failed re-breakdown must not lose generated videos |
| `@[Name]` mention grammar resolved by `RequestShotVideo`; adapters render the provider's own token | multi-word names; the API knows bindings and provider limits |
| editing an asset sets `finalPromptStale`; the prompt is kept and an explicit prompt wins | no data loss, honest UI |
| no server-side asset batch; the UI issues one request per asset with bounded concurrency | avoids multi-minute requests through the proxy |
| Next.js standalone server with a runtime proxy (`adr-0010`) | same origin for browser and API without a static export |
| English canonical texts with zh/ja/ko variants (`adr-0011`) | open, international project |
| drizzle-kit migrations applied at boot (`adr-0004`) | reviewable schema history |
| API keys are write-only; the API binds to localhost | no LAN exposure of keys |

## 3. Repository layout

```
open-drama/
  package.json                 # pnpm workspaces, root scripts (dev, build, start, typecheck, lint)
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
  apps/
    api/
      package.json             # hono, @hono/node-server, @hono/zod-validator, drizzle-orm, better-sqlite3,
                               # zod, pino, sharp, ffmpeg-static, ffprobe-static, uuid, ai, @ai-sdk/* (Plan 2)
      drizzle.config.ts
      drizzle/                 # generated SQL migrations (committed)
      src/
        index.ts               # bootstrap: env → paths → db.migrate → seeds → workspace copy-once → fail interrupted → serve
        env.ts                 # typed env (zod) and path anchors (DATA_DIR, STORAGE_ROOT, WORKSPACE_DIR, SQLITE_PATH)
        app.ts                 # Hono app: middleware, routes, static, error handler
        http/
          envelope.ts          # ok(c, data) / created / fail(c, ApiError)
          errors.ts            # ApiError(code, status, message, details)
          validate.ts          # zod-validator helpers bound to packages/contracts
          logger.ts            # pino request logging with redaction
        db/
          client.ts            # better-sqlite3 + drizzle + pragmas (WAL, busy_timeout, synchronous NORMAL)
          schema/*.ts          # one file per context
          migrate.ts           # drizzle migrator at boot
          seeds/style-presets.ts
        modules/
          production/          # dramas, episodes, pipeline status, rewrite job, EpisodeJobs
          assets/              # characters, scenes, props, links, extraction jobs
          storyboard/          # shots, bindings, parking, breakdown + prompt-batch jobs
          generation/          # task table + API; engine & adapters come from Plan 2
          compositing/         # films (merges) + ffmpeg concat
          media/               # uploads, storage helpers, renditions, storage usage
          configuration/       # model services (+ probes), style presets, app settings, readiness
          agents/              # runtime, tools, prompts/skills endpoints (Plan 2 owns the internals)
          jobs/                # agent_jobs table, runJob() wrapper, boot cleanup
        lib/
          ffmpeg.ts            # binary resolution, availability probe, spawn helpers (no fluent-ffmpeg)
          paths.ts             # abs/rel path helpers under STORAGE_ROOT
      scripts/                 # backfill-renditions.ts, smoke.sh (curl walkthrough)
    web/                       # Plan 3
  packages/
    contracts/
      src/
        common.ts              # Id, envelope, pagination, the enum table (see §5)
        production.ts assets.ts storyboard.ts generation.ts compositing.ts media.ts configuration.ts agents.ts
        quick-setup.ts         # recommended service templates (static data shared by API and web)
        index.ts               # exports schemas + z.infer types + route path constants
  workspace/
    prompts/<agent>.md (+ .zh/.ja/.ko.md)
    skills/<agent>/**/SKILL.md (+ variants)
  data/                        # runtime, git-ignored
  docker/
    Dockerfile                 # multi-stage: build contracts + api + web → runtime image running both
    docker-compose.yml
    entrypoint.sh              # workspace copy-once, start api (127.0.0.1:4000) + web (0.0.0.0:3000), exit if either exits
```

Each `modules/<context>/` folder contains `routes.ts` (Hono sub-app), `service.ts` (commands / queries, plain functions), `repo.ts` (drizzle queries) and `types.ts` when needed. Routes only parse, validate and call the service; services enforce the aggregate invariants from the domain model.

## 4. Data model

SQLite, one file `data/open-drama.sqlite3`. Ids are integer autoincrement; timestamps are ISO strings; JSON columns hold arrays. Soft delete via `deletedAt` where the domain says so.

| Table | Key columns | Domain aggregate / notes |
|---|---|---|
| `dramas` | title, description, genre, style, aspectRatio, status, tags(json), thumbnail, createdAt, updatedAt, deletedAt | production.Drama — aspectRatio immutable (enforced in service); status `draft | active | completed` |
| `episodes` | dramaId, episodeNumber, title, description, content, scriptContent, status, resolution, imageServiceId, videoServiceId, filmPath, filmDurationSeconds, durationSeconds, createdAt, updatedAt, deletedAt | production.Episode — unique(dramaId, episodeNumber) among live rows; status `draft | active | completed` |
| `characters` | dramaId, name, role, description, appearance, styling, finalPrompt, finalPromptStale, imagePath, sortOrder, createdAt, updatedAt, deletedAt | assets.Character |
| `scenes` | dramaId, location, time, prompt, lighting, finalPrompt, finalPromptStale, imagePath, … | assets.Scene (no status column: readiness is derived from tasks) |
| `props` | dramaId, name, type, description, finalPrompt, finalPromptStale, imagePath, … | assets.Prop |
| `episode_characters`, `episode_scenes`, `episode_props` | episodeId, assetId, createdAt; unique pair | episode links |
| `shots` | episodeId, shotNumber, title, shotType, angle, movement, location, time, description, result, atmosphere, imagePrompt, videoPrompt, bgmPrompt, soundEffect, durationSeconds, sceneId, referenceMedia(json), videoPath, videoDurationSeconds, parkedByJobId, createdAt, updatedAt | storyboard.Shot — unique(episodeId, shotNumber) among rows with `parkedByJobId IS NULL`; parked rows belong to a running breakdown |
| `shot_characters`, `shot_props` | shotId, assetId (pk pair) | shot bindings |
| `generation_tasks` | type(image/video), dramaId, shotId, characterId, sceneId, propId, serviceId, provider, model, prompt, params(json), providerTaskId, resultUrl, localPath, durationSeconds, status, error, errorClass, createdAt, updatedAt, completedAt | generation.GenerationTask — indexes on (type), (dramaId), (shotId), (status) |
| `films` | episodeId, dramaId, clipPaths(json), encoder, status, filmPath, durationSeconds, posterPath, error, createdAt, completedAt | compositing.Film |
| `agent_jobs` | kind(`rewrite | extraction | breakdown | videoPromptBatch`), episodeId, dramaId, target, status(`running | done | failed`), progress(json), error, startedAt, finishedAt | production.ScriptRewriteJob, assets.ExtractionJob, storyboard.StoryboardBreakdown, storyboard.VideoPromptBatch — one active job per (kind, episodeId, target) |
| `model_services` | serviceType, provider, name, baseUrl, apiKey, models(json), priority, isActive, settings(json: temperature), createdAt, updatedAt | configuration.ModelService — hard delete; apiKey never leaves the process |
| `style_presets` | name, value(unique), prompt, description, sortOrder, isActive, createdAt, updatedAt | configuration.StylePreset — seeded |
| `app_settings` | key(pk), value, updatedAt | configuration.AppSettings (`contentLanguage`, `toursSeen`) |

Migrations: `drizzle-kit generate` produces SQL under `apps/api/drizzle/`; `migrate()` runs at boot before anything else. Seeds run after migrations, idempotently (insert-if-missing; upgrade a built-in preset only when its prompt still equals the previous seed text; remove retired seeds only when unedited).

## 5. API contract

Base path `/api/v1`. JSON in and out, camelCase. Success: `{ "data": … }` (201 for creates). Errors: `{ "error": { "code": "VALIDATION_FAILED" | "NOT_FOUND" | "CONFLICT" | "PRECONDITION_FAILED" | "PROVIDER_ERROR" | "INTERNAL", "message": "…", "details"?: … } }` with matching HTTP status. Bodies and query strings are validated with the zod schemas exported from `packages/contracts`; the same schemas type the web client. Lists that can grow (dramas, tasks) accept `page`/`pageSize` and return `{ items, page, pageSize, total }`.

**Enum table** (`packages/contracts/common.ts`, the vocabulary of the whole system, `adr-0007`): `ServiceType = text | image | video`; `Resolution = 480p | 720p | 1080p`; `AspectRatio = 16:9 | 9:16 | 1:1 | adaptive`; `DramaStatus = EpisodeStatus = draft | active | completed`; `TaskStatus = FilmStatus = processing | completed | failed`; `TaskErrorClass = moderation | auth | quota | timeout | provider | config`; `JobStatus = running | done | failed`; `JobKind = rewrite | extraction | breakdown | videoPromptBatch`; `ExtractionTarget = characters | scenes | props`; `AgentType = script_rewriter | extractor | storyboard_breaker | prompt_generator`; `ContentLanguage = en | zh | ja | ko`. Durations are always `durationSeconds`. `?lang` query parameters are validated against `ContentLanguage` before any path is composed.

**Synchronous agent-backed endpoints** (`final-prompt`, `video-prompt`, `agents/:type/chat`) answer only when the agent run finishes (typically 20–90 s). They depend on the raised proxy timeout in Plan 3 / `adr-0010`; anything that can run longer (rewrite, extraction, breakdown, prompt batch, merges) is a job or task and returns an id immediately.

Endpoints, grouped by context (command / read model they implement in parentheses):

**production**

| Method | Path | Implements |
|---|---|---|
| GET | `/dramas?status&q&page&pageSize` | DramaList |
| GET | `/dramas/stats` | DramaStats |
| POST | `/dramas` | CreateDrama |
| GET | `/dramas/:id` | DramaDetail (episodes + counts) |
| GET | `/dramas/:id/assets` | assets.DramaAssetLibrary (same card shape as EpisodeAssets, with latest image task per asset) |
| PATCH | `/dramas/:id` | UpdateDrama |
| DELETE | `/dramas/:id` | DeleteDrama |
| POST | `/episodes` | CreateEpisode (locks services + resolution) |
| GET | `/episodes/:id` | episode row + locked service labels |
| PATCH | `/episodes/:id` | UpdateEpisodeContent / SetEpisodeResolution / SetEpisodeStatus (field-based) |
| DELETE | `/episodes/:id` | DeleteEpisode |
| POST | `/episodes/:id/rewrite` | RewriteScript → `{ jobId, alreadyRunning }` |
| POST | `/episodes/:id/skip-rewrite` | SkipRewrite (copies content → scriptContent) |
| GET | `/episodes/:id/pipeline-status` | EpisodePipelineStatus |
| GET | `/episodes/:id/jobs` | EpisodeJobs (latest rewrite, extraction per target, breakdown, videoPromptBatch — also serves VideoPromptBatchStatus) |

**assets**

| Method | Path | Implements |
|---|---|---|
| GET | `/episodes/:id/assets` | EpisodeAssets (linked characters, scenes, props with latest image task + extraction status) |
| POST | `/episodes/:id/extract` `{ target, model?, textServiceId? }` | StartExtraction → `{ jobId, alreadyRunning }` |
| POST | `/characters` · `/scenes` · `/props` | Create* (optional `episodeId` link) |
| PATCH | `/characters/:id` · `/scenes/:id` · `/props/:id` | Update* (fields, `finalPrompt`, `imagePath`; describing-field edits set `finalPromptStale`, an explicit `finalPrompt` wins) |
| DELETE | `/characters/:id` · `/scenes/:id` · `/props/:id` | Delete* |
| POST | `/characters/:id/final-prompt` (etc.) `{ episodeId, force?, model?, textServiceId? }` | Generate*FinalPrompt → `{ finalPrompt }` (synchronous agent run) |
| POST | `/characters/:id/image` (etc.) `{ episodeId, model?, imageServiceId?, textModel?, textServiceId? }` | Request*Image → `{ taskId }`; `409` while an image task for the asset is processing |

**storyboard**

| Method | Path | Implements |
|---|---|---|
| GET | `/episodes/:id/shots` | EpisodeShotList (shots with bindings, bound assets, `latestVideoTask`, breakdown job) |
| POST | `/episodes/:id/breakdown` `{ model?, textServiceId? }` | BreakdownStoryboard → `{ jobId, alreadyRunning }` |
| POST | `/episodes/:id/video-prompts` `{ shotIds?, model?, textServiceId? }` | StartVideoPromptBatch → `{ jobId, alreadyRunning, total }` |
| POST | `/shots` | CreateShot |
| PATCH | `/shots/:id` | UpdateShot (any field, bindings, referenceMedia, `videoPath` to pick from history) |
| DELETE | `/shots/:id` | DeleteShot |
| POST | `/shots/:id/video-prompt` `{ model?, textServiceId? }` | GenerateShotVideoPrompt → `{ videoPrompt }` (synchronous agent run) |
| POST | `/shots/:id/video` `{ prompt?, model?, videoServiceId?, durationSeconds?, extraReferenceImageUrls?, referenceVideoUrls?, referenceAudioUrls?, generateAudio? }` | RequestShotVideo → `{ taskId }`; `409` while a video task for the shot is processing |
| GET | `/shots/:id/videos` | completed video tasks of the shot, newest first (history) |

**generation**

| Method | Path | Implements |
|---|---|---|
| POST | `/generation-tasks` `{ type, … }` | SubmitImageGeneration / SubmitVideoGeneration (generic, for advanced use) |
| GET | `/generation-tasks?type&dramaId&shotId&status&page` | task list (paginated) |
| GET | `/generation-tasks/:id` | GenerationTaskStatus |
| DELETE | `/generation-tasks/:id` | DeleteGenerationTask |
| GET | `/episodes/:id/generation-tasks?limit` | EpisodeGenerationTasks (tasks + films, newest first, default 50 tasks / 20 films) |

**compositing**

| Method | Path | Implements |
|---|---|---|
| POST | `/episodes/:id/merge` `{ shotIds? }` | MergeShots → `{ filmId }`; `409` while a merge for the episode is processing |
| GET | `/episodes/:id/films` | EpisodeFilms |
| GET | `/episodes/:id/films/latest` | LatestMergeStatus |

**media**

| Method | Path | Implements |
|---|---|---|
| POST | `/media/upload/image` (multipart `file`) | UploadMedia → `{ path, url }` |
| POST | `/media/upload/video` · `/audio` | UploadMedia for reference media — lands with Plan 2 Phase F (first adapter that accepts them) |
| GET | `/static/*` | file serving from `STORAGE_ROOT` with `Cache-Control: public, max-age=31536000, immutable`, range requests |
| GET | `/storage` | StorageUsage (60 s cache, stale-while-revalidate) |

**configuration**

| Method | Path | Implements |
|---|---|---|
| GET | `/model-services?type` | ActiveModelServices / full list — `apiKey` is never returned; rows carry `hasKey` |
| POST · PATCH · DELETE | `/model-services[/:id]` | Add / Update / DeleteModelService (`apiKey` accepted on write only) |
| POST | `/model-services/test` | TestModelService (probes in this module; 15 s fetch timeout) |
| POST | `/model-services/quick-setup` `{ apiKey, gateway }` | ApplyQuickSetup (templates are static data in `packages/contracts/quick-setup.ts`, shared with the web app) |
| GET | `/model-services/readiness` | ConfigurationReadiness |
| GET · POST · PATCH · DELETE | `/style-presets[?all=1][/:id]` | StylePresetCatalog / Create / Update / Delete |
| GET · PATCH | `/settings` | AppSettingsView / SetContentLanguage / RecordToursSeen |

**agents** (routes live here; internals in Plan 2)

| Method | Path | Implements |
|---|---|---|
| GET | `/agents?lang` | AgentCatalog |
| GET · PUT · DELETE | `/agents/:type/prompt?lang` | prompt read / SaveAgentPrompt / ResetAgentPrompt |
| POST | `/agents/:type/chat` `{ message, dramaId, episodeId, model?, textServiceId? }` | RunAgent (debug / power-user entry, synchronous) |
| GET · POST | `/skills?lang` · `/skills` | SkillCatalog / CreateSkill |
| GET · PUT · DELETE | `/skills/*?lang` | skill read / UpdateSkill / DeleteSkill |

**system**

| Method | Path | |
|---|---|---|
| GET | `/health` | `{ status, version, timestamp }` |

Read model → endpoint map for the implicit ones: `VideoPromptBatchStatus` and `EpisodeJobs` → `GET /episodes/:id/jobs`; `LatestMergeStatus` → `/episodes/:id/films/latest`; `StorageUsage` → `/storage`; `DramaAssetLibrary` → `/dramas/:id/assets`; `AppSettingsView` → `/settings`.

## 6. Cross-cutting design

**Configuration** (`env.ts`, zod-parsed at boot; every value has a default so local dev needs no `.env`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `HOST` | `127.0.0.1` | API bind address (only the web port is meant to be exposed) |
| `OPEN_DRAMA_DATA_DIR` | `<repo>/data` | data root |
| `SQLITE_PATH` | `$DATA_DIR/open-drama.sqlite3` | database file |
| `STORAGE_PATH` | `$DATA_DIR/static` | media root |
| `WORKSPACE_PATH` | `$DATA_DIR/workspace` | writable prompts/skills (copy-once from `<repo>/workspace`) |
| `PUBLIC_BASE_URL` | unset | needed only when a video provider must fetch a local reference video/audio |
| `FFMPEG_BIN`, `FFPROBE_BIN` | bundled | override binaries |
| `OPEN_DRAMA_AI_DISABLE_THINKING`, `OPEN_DRAMA_AI_MAX_TOKENS`, `OPEN_DRAMA_AI_THINKING_OFF_PATCH` | see Plan 2 | transport patches |
| `OPEN_DRAMA_STUB_PROVIDERS` | unset | `1` registers the stub adapters (Plan 2) for offline development |
| `LOG_LEVEL` | `info` | pino |
| `OPEN_DRAMA_VERSION` | from package.json | reported by `/health` |

**Startup sequence** (`index.ts`): parse env → ensure directories → open SQLite with pragmas → run migrations → seed style presets → copy workspace template once (marker file `.template-version`; later versions only add missing files) → probe FFmpeg (warn, don't fail) → boot cleanup: `FailInterruptedTasks` on `generation_tasks`, `films` and `agent_jobs` still running, restoring shots parked by a failed breakdown → mount routes → listen on `HOST:PORT`. Log one line per step.

**HTTP layer**: Hono app with `cors` limited to the web origin in dev, pino request log (method, path, status, ms; bodies only at debug level, redacted), zod validation middleware, a single error handler mapping `ApiError` and zod errors to the envelope, and static serving of `STORAGE_ROOT` under `/static` with immutable caching and range support (verified in Phase 3; replaced by a small custom handler if the adapter's `serveStatic` falls short). Never serve the workspace or the database.

**Jobs** (`modules/jobs`): `runJob({ kind, episodeId, dramaId, target }, fn)` returns the existing job (`alreadyRunning: true`) when one is running for the key, otherwise inserts an `agent_jobs` row, runs `fn(progress)` detached, records `done`/`failed` with timestamps, and lets `fn` update `progress` (used by the prompt batch: total/completed/failed/currentShotId). The breakdown job parks the episode's shots on its first `replaceExisting` batch (`parkedByJobId = jobId`), purges them on `done`, restores them on `failed`; boot cleanup performs the same restore. `GET /episodes/:id/jobs` returns the latest job per (kind, target). Generation tasks keep their own table because they carry provider state; boot cleanup applies to both.

**Media** (`modules/media`): uuid file names with the original extension under `static/{uploads|images|videos|merged|temp}`; `storeRemoteFile(url, kind)`, `storeInlineImage(b64, mime)`, `deriveRenditions(path, kind)` (400 px WebP thumbnail via sharp; 640 px JPEG poster at 0.5 s via FFmpeg; never throws), `toAbsolute(rel)` that refuses paths escaping `STORAGE_ROOT`, upload validation (image by extension; video ≤ 50 MB `.mp4/.mov/.webm/.m4v`; audio ≤ 20 MB `.mp3/.wav/.m4a/.aac`; MIME checked when present and not `octet-stream`), and `storageUsage()` walking the data dir by bucket with a 60 s cache.

**Compositing** (`modules/compositing`): `mergeShots(episodeId, shotIds?)` → load live shots in shot order, filter to those with `videoPath`, verify each file exists (reject naming missing shot numbers), verify the FFmpeg suite, reject with `409` if a film for the episode is processing, insert `films` row `processing`, then detached: write the concat list under `static/temp`, spawn `ffmpeg-static` directly (`-f concat -safe 0 -i list -fflags +genpts -c:v libx264 -preset medium -crf 23 -c:a aac -ar 48000 -b:a 192k -movflags +faststart`), ffprobe the duration, `deriveRenditions(film, 'video')`, update the film row, `AttachEpisodeFilm`. Failures set `error`. No `fluent-ffmpeg` (unmaintained); `lib/ffmpeg.ts` wraps `child_process.spawn` with timeouts and stderr capture.

**Style prompt injection**: `getDramaStylePrompt(dramaId)` returns the preset fragment or `''`. It is prepended by the assets final-prompt save tools and by `RequestShotVideo`; the frontend never adds style words.

**Reference resolution for shot videos** (`RequestShotVideo`, Phase 5): ordered slots = bound scene → bound characters (list order) → bound props, skipping assets without an image, then `extraReferenceImageUrls` from the request; deduplicated by path; capped at the provider limit from the adapter registry. Each `@[Name]` in the prompt (longest names first, exact match against bound asset names) becomes `{ slot, name }`; the adapter renders the slot in its own token syntax or as plain `Name` when it has none. Unmatched mentions are left as plain text and reported in the task `params` for the UI to warn about.

**Locked services and fallbacks**: `resolveService({ explicitId?, episodeLockId?, type })` implements the order explicit → locked (if still active) → highest-priority active; returns `null` → `PRECONDITION_FAILED` with a message pointing to Settings.

**Security baseline**: no auth (single-user, self-hosted) but: API keys are write-only (never returned by any endpoint, masked in logs); the API binds to `127.0.0.1` by default and only the web port is exposed; uploads are size- and type-checked; `/static` is confined to the storage root; agent workspace file operations are jailed to `WORKSPACE_PATH` and reject `..`; `?lang` and skill ids are validated before path composition; CORS is off in production (same origin through the Next proxy). The README states that exposing the web port exposes the whole tool and recommends a reverse proxy with authentication for anything beyond a private network.

## 7. Work breakdown

Each phase ends with a "done when" that is checked by running the system (`pnpm dev`, then the listed `curl` calls or `apps/api/scripts/smoke.sh`), plus `pnpm typecheck` and `pnpm lint` green. Per the repository's working rules no test suites are written unless explicitly requested; verification is by execution.

### Phase 0 — Monorepo bootstrap (½ day)
- `pnpm-workspace.yaml` with `apps/*`, `packages/*`; root scripts `dev` (runs api + web with `concurrently`), `build`, `start`, `typecheck`, `lint`, `format`.
- `tsconfig.base.json` (strict, ES2022, NodeNext for api, bundler for web), ESLint flat config + Prettier shared.
- `packages/contracts` package with `zod` and a build that emits types (tsup or plain `tsc`).
- `apps/api` with `tsx watch` dev script and `tsc` build; `apps/web` created by Plan 3 Phase 0 (a placeholder Next app is fine here).
- `.env.example`, `README` quick-start section, `"license": "CC-BY-NC-SA-4.0"` in every `package.json`, `CONTRIBUTING.md` (contributions are original work under the repository licence, `adr-0001`).
- Done when: `pnpm install && pnpm dev` starts both processes; `curl :4000/api/v1/health` returns `{ data: { status: 'ok' } }`.

### Phase 1 — API skeleton, database, contract, readiness (1–2 days)
- `env.ts`, path anchors, `db/client.ts` with WAL/busy_timeout/synchronous, `migrate.ts`, first migration with every table from §4.
- `http/` envelope, `ApiError`, error handler, request logger, validation helper.
- `contracts/common.ts` enum table and envelope; route path constants.
- Startup sequence from §6 including boot cleanup (no-op on an empty DB) and the workspace copy-once.
- `GET /model-services/readiness` (so the web shell's banner works from M0).
- Done when: a fresh checkout boots, creates `data/open-drama.sqlite3` with all tables (`sqlite3 data/open-drama.sqlite3 .tables`), an invalid body to any route returns a `VALIDATION_FAILED` envelope, and readiness lists all three missing types.

### Phase 2 — configuration: model services, style presets, settings (1 day)
- `model_services` CRUD with provider validation per type, priority ordering, temperature normalisation, write-only keys (`hasKey` in responses).
- `POST /model-services/test` probes defined in this module (OpenAI-style: `GET /v1/models`; Gemini: minimal `generateContent`; video providers: an empty task post that creates no billable work; 200/204/400/401/403 count as reachable; 15 s timeout). Plan 2 adapters may register additional probes.
- Quick setup: templates from `packages/contracts/quick-setup.ts`; upsert by name or (type, provider, baseUrl).
- Style presets seed (our own fragments) + CRUD; `settings` (contentLanguage default `en`, toursSeen).
- Done when: after `POST` of a text service, readiness lists two missing types; the test endpoint returns `reachable: true` against a real key and a masked row on `GET`.

### Phase 3 — production and media (1–2 days)
- Dramas CRUD with counts and pagination; stats; soft delete cascade visibility rules.
- Episodes: create (next number, locked services, resolution), patch (field-based command dispatch with invariants), delete, get; `skip-rewrite` copies content → scriptContent; the rewrite endpoint via `runJob` (agent from Plan 2 Phase A; until then the job fails with "agent runtime not available").
- `pipeline-status` derivation (script ready/done; per-type asset counts; shots; videos; latest film; completed flag); `GET /episodes/:id/jobs`.
- `media` uploads + static serving + renditions + storage usage.
- Done when: create drama → create episode returns locked ids; creating an episode with no active image service fails with `PRECONDITION_FAILED`; skip-rewrite makes `pipeline-status.script = done` after a reload; an uploaded PNG is reachable under `/static/uploads/<uuid>.png` with its `_thumb.webp`; a 100 MB file under `/static` plays in a paused-then-resumed `<video>` through the Next proxy (range requests, >30 s idle) — this check gates `adr-0010`.

### Phase 4 — assets (1–2 days)
- Characters/scenes/props CRUD with episode linking, near-name normalisation helpers (shared with Plan 2 tools), soft delete removing links, `finalPromptStale` rules (explicit prompt wins).
- `GET /episodes/:id/assets` and `GET /dramas/:id/assets` projections (readiness derived from `imagePath` + latest image task state).
- `POST /episodes/:id/extract` through `runJob` calling the Plan 2 extractor; status via `/jobs`.
- Final-prompt and image endpoints delegate to Plan 2 (`ensureFinalPrompt`, `generation.submitImage`); `409` while an image task for the asset is processing; write-back of `imagePath` on task completion (policy `AttachAssetImageOnGeneration` implemented as the task completion hook).
- Done when: with Plan 2 Phase B in place, extracting characters from a sample script creates rows linked to the episode, re-extracting merges instead of duplicating, and `PATCH` of `appearance` sets `finalPromptStale` while keeping the prompt; with the stub image adapter (Plan 2 Phase E), requesting an image lands a file and sets `imagePath`.

### Phase 5 — storyboard (1–2 days)
- Shots CRUD, `saveShots` batch upsert (parking on `replaceExisting`, shotNumber matching, binding validation with auto-link, episode duration recompute), reference media JSON, history pick (`videoPath`).
- `GET /episodes/:id/shots` projection with `latestVideoTask`; breakdown and prompt-batch endpoints via `runJob` (Plan 2 agents); `POST /shots/:id/video` implementing `RequestShotVideo` as in §6 (guard: prompt or references; `409` while processing), then `generation.submitVideo`.
- Task completion hook attaches `videoPath`/duration to the shot (`AttachShotVideoOnGeneration`).
- Done when: a manual `POST /shots` + `POST /shots/:id/video` with the stub video adapter creates a task and, on completion, the shot's `videoPath` is set; a binding to a character of another drama is rejected; killing the API during a breakdown job and restarting restores the parked shots and marks the job `failed`.

### Phase 6 — generation task API (½ day, engine in Plan 2)
- `generation_tasks` repo, list/get/delete endpoints, `EpisodeGenerationTasks` aggregation through shot/asset ownership with the default caps. The generic `POST /generation-tasks` is left out until something needs it: every generation goes through the owner's command (`Request*Image`, `RequestShotVideo`), which resolves prompts, references and locks.
- Done when: the task list filters by `shotId` and the episode aggregation includes films and stops at the cap.

### Phase 7 — compositing (1 day)
- FFmpeg availability probe (spawn `-version`, cached on success), merge flow from §6, films endpoints, one-merge-per-episode guard.
- Done when: two short stub clips merge into an MP4 under `static/merged/`, the film has a duration and a poster, and the episode's `filmPath` points at it; a merge with a deleted clip file fails fast naming the shot.

### Phase 8 — deployment (1 day)
- `docker/Dockerfile`: stage 1 build contracts + api (`tsc`), stage 2 build web (`next build`, `output: 'standalone'`), runtime stage on `node:22-bookworm-slim` with both apps, `ffmpeg-static` binaries, `entrypoint.sh` that exports `API_ORIGIN=http://127.0.0.1:4000`, starts the API on `127.0.0.1:4000` and the web on `0.0.0.0:3000`, forwards `SIGTERM` to both and exits when either child exits (`wait -n`), healthcheck on `/api/v1/health` through the API, `VOLUME /app/data`.
- `docker-compose.yml`: one service, named volume `open-drama-data`, port `3000`.
- Non-Docker: `pnpm build && pnpm start` runs both with `concurrently`; document `PUBLIC_BASE_URL`, `HOST` and the exposure warning.
- Done when: `docker compose up --build` serves the launcher on `:3000`, creates a drama, and the data persists across `down/up`; `docker stop` terminates both processes cleanly.

Estimated total: 8–11 working days for one engineer, assuming Plan 2 phases A–E land in parallel.

## 8. Verification

- `pnpm typecheck` and `pnpm lint` at the root, both blocking.
- `apps/api/scripts/smoke.sh`: a curl walkthrough that creates a drama and an episode, uploads an image, creates a character, patches it, creates a shot, requests a video with the stub adapter, merges, and prints every envelope. Run after each phase.
- Manual: boot with an empty `data/`, kill the process mid-generation and mid-breakdown, boot again, confirm the task is `failed` with the restart message and the parked shots are back.
- `dkk validate` stays green; when a module lands, add its `code_refs` glob to the context's `context.yml` so `dkk drift` can track it.

## 9. Risks and open questions

- **better-sqlite3 native builds** on Docker multi-arch: pin the Node version and rebuild in the image; fall back to `node:22-bookworm` (non-slim) if prebuilds are missing.
- **Proxying media through Next** doubles the hop for large videos and shares the proxy idle timeout; the Phase 3 check is the gate. If it fails, expose the API origin to the browser for `/static` only (build-time `NEXT_PUBLIC_API_ORIGIN`, CORS on `/static`).
- **Single-user, no auth**: acceptable for a self-hosted tool bound to localhost; a reverse proxy with authentication is the documented answer for exposed deployments. Adding accounts later means adding `ownerId` to dramas and model services.
- **Concurrency in SQLite**: WAL + busy timeout handles the polling load; keep transactions short in `saveShots`.
- Open: whether to ship a recommended gateway in quick setup or a neutral list; whether the desktop shell is wanted at all. Resolved: licence is CC BY-NC-SA 4.0 (`adr-0012`, `LICENSE` at the root, SPDX id in every `package.json` from Phase 0); providers are the official endpoints plus BytePlus and ModelRunner, the latter two deferred to iteration 2 (`adr-0013`, `docs/BACKLOG.md`).

## 10. Later

Electron desktop shell (utility-process API + same-origin window + data-dir migration + updater), in-app update checks, multi-user auth, SSE/WebSocket push instead of polling, shot frame images (first/last frame stills for image-to-video providers), a cleanup command for orphaned media files.
