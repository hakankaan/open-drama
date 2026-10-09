# Implementation plans

Four plans cover four sections of Open Drama. They are written against the domain model in `.dkk/domain/` and the decisions in `.dkk/adr/`; item names in the plans (commands, read models, aggregates) are the model's names, and the enum vocabulary is the one in `adr-0007`.

| Plan | Section | Owns |
|---|---|---|
| [01-backend.md](01-backend.md) | Backend platform (Node.js API) | monorepo, API server, SQLite + Drizzle, shared contract, endpoints for all eight contexts, media, jobs infrastructure, FFmpeg compositing, deployment |
| [02-ai-pipeline.md](02-ai-pipeline.md) | AI pipeline | agent runtime + the agents, prompts/skills workspace, transport patches, generation engine, stub + provider adapters, reference normalisation, write-back |
| [03-frontend.md](03-frontend.md) | Frontend (Next.js) | launcher, settings, project page, episode studio, design system, i18n, polling and state |
| [04-story-development.md](04-story-development.md) | Story development (`adr-0015`) | story writer, episode planner and episode writer agents, the outline on the drama, drama-scoped jobs, the Story tab, the plan dialog and the Expand action — a cross-cutting change to all three sections |

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

Iteration 1 video adapters (M3) are Seedance via Volcengine, then MiniMax, then Wan (`adr-0013`); BytePlus (a Volcengine alias) and ModelRunner joined iteration 1 on 2026-09-29 (`adr-0013` amendments).

## Decisions

`adr-0001` … `adr-0014` are accepted; `adr-0015` (story development) was accepted after its live run on 2026-10-09. Replace one with `dkk new adr "…" --supersedes adr-000N`.

Resolved: all code, prompts and copy are original work (`adr-0001`); the licence is CC BY-NC-SA 4.0 (`adr-0012`); providers are the official endpoints of the supported models plus BytePlus and ModelRunner, both shipping in iteration 1 (`adr-0013`). Still open: whether to keep a "recommended gateway" quick setup, and whether an Electron desktop shell is wanted.
