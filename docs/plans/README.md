# Implementation plans

Seven plans cover the sections of Open Drama. They are written against the domain model in `.dkk/domain/` and the decisions in `.dkk/adr/`; item names in the plans (commands, read models, aggregates) are the model's names, and the enum vocabulary is the one in `adr-0007`.

| Plan | Section | Owns |
|---|---|---|
| [01-backend.md](01-backend.md) | Backend platform (Node.js API) | monorepo, API server, SQLite + Drizzle, shared contract, endpoints for all eight contexts, media, jobs infrastructure, FFmpeg compositing, deployment |
| [02-ai-pipeline.md](02-ai-pipeline.md) | AI pipeline | agent runtime + the agents, prompts/skills workspace, transport patches, generation engine, stub + provider adapters, reference normalisation, write-back |
| [03-frontend.md](03-frontend.md) | Frontend (Next.js) | launcher, settings, project page, episode studio, design system, i18n, polling and state |
| [04-story-development.md](04-story-development.md) | Story development (`adr-0015`) | story writer, episode planner and episode writer agents, the outline on the drama, drama-scoped jobs, the Story tab, the plan dialog and the Expand action — a cross-cutting change to all three sections |
| [05-assistant-access.md](05-assistant-access.md) | Assistant access (`adr-0016`) | the MCP endpoint as a second presentation layer beside the studio, the server-issued token, the assistant skills in the workspace, the service rules both interfaces share (locks at first use, revision tokens, replace and force), the API-only deployment shape, the generated Claude Code plugin |
| [06-consistency.md](06-consistency.md) | Consistency within and between episodes (`adr-0017` to `adr-0023`) | prompt discipline and reference caps, seeds and the negative prompt, the episode's pinned video model, the workspace template upgrade, character views (headshot, body, side, back) sent per the video model's reference policy, post conform and series look, keyframes, continuous takes, pinned voices and shot checks by a vision model, per-episode outfits (`adr-0023`) (done) |
| [07-assets-from-story.md](07-assets-from-story.md) | Assets from the story (`adr-0024`) | the asset designer agent that turns the outline into a designed cast, places and props on the drama, final prompts and reference images without an episode, the extractor dressing a designed character for the episode, a describe action for one asset, the assets tools over MCP (paid image calls wait for the `adr-0016` opt-in) |

## Milestones across the plans

| Milestone | Backend (1) | AI pipeline (2) | Frontend (3) | Proof |
|---|---|---|---|---|
| M0 Skeleton | Phase 0–1 | — | Phase 0 | `pnpm dev` boots both apps; health, readiness banner and the proxy checks (90 s response, paused video) pass |
| M1 Configure + create | Phase 2–3 | — | Phase 1–3 (Phase 3 without generation) | quick setup, create drama and episode, upload an image to an asset |
| M2 Script + assets | Phase 4 | Phase A, B, C, D, E (stub + image adapters) | Phase 4–5 | paste text → script (or skip) → extracted assets with images, offline with stubs and online with a real image provider |
| M3 Storyboard + videos | Phase 5–6 | Phase F (needs the video-provider decision first) | Phase 6 | breakdown → prompts → batch shot videos with retries, offline with stubs and online with a real video provider |
| M4 Export | Phase 7 | — | Phase 7 | merged film playable and downloadable |
| M5 Ship | Phase 8 | Phase G | Phase 8 | Docker image, four languages, tours, log redaction audit |
| M6 Story development | Plan 4 Phase 2 (migration `0004`, drama-scoped jobs) | Plan 4 Phases 1, 3, 4 (three agents, workspace v6) | Plan 4 Phases 3–4 (Story tab, plan dialog, Expand) | outline → plan N episodes → expand each into a script → recaps, offline with the stub model; then one live run on the ModelRunner text model |
| M7 Assistant access | Plan 5 Phases 1–2 (`/mcp`, token, migration `0006`, service rules, API-only shape) | Plan 5 Phase 3 (workspace v7: assistant instructions and skills) | Plan 5 Phase 1 (Settings › Assistant card, lock label, `/mcp` forwarded) | an assistant connected with the token runs set-up → create-story → write-episodes on the stub model against the API's port alone, and through the web proxy; the studio works with the endpoint off |

Iteration 1 video adapters (M3) are Seedance via Volcengine, then MiniMax, then Wan (`adr-0013`); BytePlus (a Volcengine alias) and ModelRunner joined iteration 1 on 2026-09-29 (`adr-0013` amendments).

## Parity inventory (`adr-0016`)

Every command and query of the domain model, its REST route and its MCP tool. A use case is done when both exist, or when it falls under one of the three exceptions: **S** secrets (a key never travels over MCP), **B** binary media, **I** one interface's own state. "it. 2" marks the production floor and the editing use cases that iteration 2 delivers; until then the assistant covers configuration, the story room and the text side of the assets (`adr-0024`).

| Context | Command / read model | REST | MCP tool |
|---|---|---|---|
| configuration | ConfigurationReadiness | `GET /model-services/readiness` | `get_status` |
| configuration | ActiveModelServices | `GET /model-services` | `list_model_services` (never the key) |
| configuration | ModelCatalog | `GET /model-services/modelrunner-catalog` | `browse_model_catalog` |
| configuration | AddModelService | `POST /model-services` | `add_model_service` (S: without `apiKey`; the key by studio, environment or `PATCH`) |
| configuration | UpdateModelService | `PATCH /model-services/:id` | `update_model_service` (S: without `apiKey`) |
| configuration | DeleteModelService | `DELETE /model-services/:id` | `delete_model_service` |
| configuration | TestModelService | `POST /model-services/test` | `test_model_service` (S: a saved service with its stored key) |
| configuration | ApplyQuickSetup | `POST /model-services/quick-setup` | S — named by `get_status` with its environment variable |
| configuration | StylePresetCatalog | `GET /style-presets` | `list_style_presets` |
| configuration | CreateStylePreset / UpdateStylePreset / DeleteStylePreset | `POST` / `PATCH` / `DELETE /style-presets` | `create_style_preset` / `update_style_preset` / `delete_style_preset` |
| configuration | AppSettingsView | `GET /settings` | `get_settings` |
| configuration | SetContentLanguage | `PATCH /settings` | `update_settings` |
| configuration | RecordToursSeen | `PATCH /settings` | I — the studio's tours |
| configuration | AssistantConnection (token) | `GET` / `POST /settings/assistant(/rotate)` | I — the token is never a tool result |
| production | DramaList, DramaStats | `GET /dramas`, `GET /dramas/stats` | `list_dramas`, `get_status` |
| production | DramaDetail | `GET /dramas/:id` | `get_drama` |
| production | CreateDrama / UpdateDrama | `POST` / `PATCH /dramas` | `create_drama` / `update_drama` (outline through `save_outline`) |
| production | DeleteDrama | `DELETE /dramas/:id` | it. 2 `delete_drama` |
| production | SaveOutline | agent tool; `PATCH /dramas/:id` | `save_outline` (with `ifRevision`) |
| production | WriteOutline | `POST /dramas/:id/outline` | `write_outline` |
| production | PlanEpisodes / AddPlannedEpisodes | `POST /dramas/:id/plan` | `plan_episodes` |
| production | DramaJobs, EpisodeJobs | `GET /dramas/:id/jobs`, `GET /episodes/:id/jobs` | `get_jobs`, `wait_for_job` |
| production | CreateEpisode | `POST /episodes` | `create_episode` |
| production | EpisodeView (with SeriesContext sizes), EpisodePipelineStatus | `GET /episodes/:id`, `GET /episodes/:id/pipeline-status` | `get_episode`, `read_episode` |
| production | UpdateEpisodeContent (title, synopsis, beats, script, recap) | `PATCH /episodes/:id` | `update_episode`, `save_beats`, `save_script`, `save_recap` (with `ifRevision`) |
| production | SetEpisodeResolution / SetEpisodeTargetDuration / SetEpisodeStatus | `PATCH /episodes/:id` | `update_episode` |
| production | DeleteEpisode | `DELETE /episodes/:id` | `delete_episode` (with `force`) |
| production | RewriteScript / WriteEpisodeScript | `POST /episodes/:id/rewrite` / `write` | `rewrite_script` / `write_episode_script` |
| production | SkipRewrite | `POST /episodes/:id/skip-rewrite` | `use_content_as_script` |
| production | WriteRecap | `POST /episodes/:id/recap` | `write_recap` |
| production | SaveScript, SaveRecap (agent saves) | agent tools | the agents' own; the assistant's edits above |
| production | AttachEpisodeFilm | compositing, internal | — (not a user command) |
| production | CancelAgentJob | `POST /agent-jobs/:id/cancel` | `cancel_job` |
| production | SeriesContext | internal (agents) | — (not a user query) |
| agents | AgentCatalog, SkillCatalog | `GET /agents`, `GET /skills` | it. 2 (resources) |
| agents | SaveAgentPrompt / ResetAgentPrompt / CreateSkill / UpdateSkill / DeleteSkill | `PUT`/`DELETE /agents/:type/prompt`, `/skills` | it. 2 `update_agent_prompt`, `update_agent_skill`, … |
| agents | RunAgent (chat) | `POST /agents/:type/chat` | it. 2 |
| assets | EpisodeAssets, DramaAssetLibrary | `GET /episodes/:id/assets`, `GET /dramas/:id/assets` | `list_assets` (with `episodeId` for an episode's assets and outfits) |
| assets | Create/Update/Delete Character, Prop, Scene | `POST` / `PATCH` / `DELETE /{characters,scenes,props}` | `create_asset` / `update_asset` (no revision: last write wins, as in the studio, and refused while the asset is claimed; media paths, voice and sort order stay with the studio, B/I) / `delete_asset` (with `confirm`) |
| assets | StartExtraction; DesignAssets (`adr-0024`) | `POST /episodes/:id/extract`; `POST /dramas/:id/design` | `extract_assets`; `design_assets` (outcome `design` in `wait_for_job`) |
| assets | DescribeAsset (`adr-0024`); Generate…FinalPrompt | `POST /{characters,scenes,props}/:id/describe`; `…/:id/final-prompt` | `describe_asset` (with `replace`); `write_final_prompt` (with `replace` for the route's `force`, `episodeId` optional) |
| assets | Request…Image (paid); SetEpisodeOutfit, RequestOutfitImage (paid, `adr-0023`) | `…/:id/image`; `PATCH /characters/:id/outfit`, `…/outfit/image` | it. 2 (paid opt-in) `generate_asset_image` (also the outfit picture), `set_episode_outfit` |
| storyboard | EpisodeShotList, VideoPromptBatchStatus; BreakdownStoryboard; Create/Update/Delete Shot; GenerateShotVideoPrompt, StartVideoPromptBatch; RequestShotVideo (paid; `seed` for retakes, `adr-0017`) | storyboard routes | it. 2 `breakdown_storyboard`, `list_shots`, `create_shot`, `update_shot`, `delete_shot`, `generate_video_prompts`, `generate_shot_videos` |
| generation | EpisodeGenerationTasks, GenerationTaskStatus, DeleteGenerationTask | generation routes | it. 2 `list_generation_tasks` |
| compositing | MergeShots, EpisodeFilms, LatestMergeStatus | compositing routes | it. 2 `merge_episode`, `get_films` (URLs under `/static`) |
| media | UploadMedia | `POST /media` | B — the REST upload route, documented with a `curl` |
| media | StorageUsage, OrphanedMedia, CleanUpOrphanedMedia | media routes | I — the studio's storage tab |

## Decisions

`adr-0001` … `adr-0014` are accepted; `adr-0015` (story development) was accepted after its live run on 2026-10-09; `adr-0016` (two interfaces over one service layer) was accepted on 2026-10-13 after plan 05's walkthroughs in both deployment shapes and the Codex pass over the finished diff. Replace one with `dkk new adr "…" --supersedes adr-000N`.

Resolved: all code, prompts and copy are original work (`adr-0001`); the licence is CC BY-NC-SA 4.0 (`adr-0012`); providers are the official endpoints of the supported models plus BytePlus and ModelRunner, both shipping in iteration 1 (`adr-0013`). Still open: whether to keep a "recommended gateway" quick setup, and whether an Electron desktop shell is wanted.
