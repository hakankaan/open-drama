# Open Drama

**An open, self-hostable AI short-drama studio.** Paste a story, and Open Drama takes it through the whole production line: script rewriting, character/scene/prop extraction with consistent reference images, storyboard breakdown into shots, per-shot video generation, and FFmpeg compositing into a finished episode.

Open Drama is built on **Next.js** (web) and **Node.js** (API), with a documented domain model and architecture decisions, and is released under CC BY-NC-SA 4.0 (see `.dkk/adr/adr-0012.md`).

> **Status: iteration 1 complete.** The whole line runs, from raw text to a merged episode film, in four UI languages (the zh/ja/ko catalogs are machine drafts awaiting native review). Real providers still need end-to-end checks with live keys; see `docs/BACKLOG.md`.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The API listens on `127.0.0.1:4000` and the web server forwards `/api` and `/static` to it. Data (SQLite, media, agent workspace) lives in `./data`. If port 3000 is taken, run `WEB_PORT=3100 pnpm dev`. Configuration is optional; see `.env.example`.

Requires Node.js 22+ and pnpm 12. No database server is needed, and no FFmpeg install on macOS, Windows or Linux x64. On Linux arm64 the bundled package has no ffprobe: install FFmpeg and set `FFPROBE_BIN=/usr/bin/ffprobe` (the Docker image already does this).

> Open Drama has no user accounts. Anyone who can reach the web port can use the whole tool, including your API keys. Keep it on a private network, or put a reverse proxy with authentication in front.

### Run with Docker

```bash
docker compose up --build
```

One container runs both processes. The web app is published on port 3000 (`OPEN_DRAMA_PORT=8080 docker compose up` picks another host port), and the API stays on the container's localhost. Everything the app stores lives in the `open-drama-data` volume, so it survives `docker compose down` and rebuilds. FFmpeg comes from the image.

### Run in production without Docker

```bash
pnpm install
pnpm build
pnpm start
```

The API runs on `127.0.0.1:4000` and the web server on `0.0.0.0:${WEB_PORT:-3000}`. Settings worth knowing (all optional; see `.env.example`):

| Variable | When to set it |
|---|---|
| `OPEN_DRAMA_DATA_DIR` | keep data somewhere other than `./data` |
| `PUBLIC_BASE_URL` | a video provider must fetch one of your uploaded reference videos or audio files; it needs a public https address |
| `HOST` | only if the API must listen beyond localhost, which it normally should not |
| `OPEN_DRAMA_VIDEO_CONCURRENCY` | how many shot videos one episode generates at once (default 4); the rest wait their turn |
| `OPEN_DRAMA_STUB_PROVIDERS=1` | try the whole flow offline: image and video generation use local placeholders, text uses a scripted model |

---

## What it does

```
Raw content  ──►  Script  ──►  Assets  ──►  Storyboard & Videos  ──►  Merge & Export
(novel, outline)  AI rewrite   characters    shots · prompts ·        FFmpeg concat
                               scenes        reference-guided         → episode film
                               props         video generation
```

- **Script stage** – paste a novel chapter or outline; the script-rewriter agent turns it into a formatted shooting script (or skip the rewrite).
- **Story development** – the story-writer agent drafts a story outline from your synopsis (or write it yourself on the Story tab); the episode-planner agent cuts the next episodes from it, each with a title, a synopsis and a beat sheet; the episode-writer agent expands a beat sheet into the script. Written episodes feed later plans through their recaps.
- **Series continuity** – a project whose episodes continue one story gets a recap of every episode, written by the recap-writer agent after the script is saved and editable by you; the script and storyboard agents of later episodes receive the project synopsis and the earlier recaps. Turn it off per project for anthologies.
- **Assets stage** – the extractor agent pulls characters, scenes and plot-critical props out of the script, deduplicated across the whole drama. Each asset gets an AI-written final prompt and a reference image (turnaround sheet, empty establishing shot, white-background product shot). Upload your own images instead if you prefer.
- **Storyboard & video stage** – the storyboard-breaker agent splits the script into 8–15 s shots with sub-shot descriptions, bindings and video prompts. Review prompts with `@mentions` of your assets, pick the video model and resolution, generate shot videos singly or in batch, retry failures.
- **Merge & export** – select shots, let FFmpeg concatenate them into the episode film, play, download, mark done.
- **Bring your own models** – text, image and video providers are configured in the UI: the official endpoints of the supported model families (OpenAI, Gemini, Volcengine Ark, MiniMax, Alibaba Wan) plus BytePlus ModelArk and ModelRunner. Keys live in the local database, never in files.
- **Editable agents** – every agent's system prompt and skills are Markdown files you can edit from Settings, with per-language variants.

## Architecture

```
apps/web         Next.js (App Router, TypeScript, Tailwind) — launcher, settings, project page, episode studio
apps/api         Node.js API (Hono) — SQLite via Drizzle, agent runtime on the AI SDK, generation engine, FFmpeg
packages/contracts  zod schemas + types shared by web and api (the API contract)
workspace/       agent prompt + skill templates (copied once into the data directory, then editable)
data/            runtime data: open-drama.sqlite3, static media, writable workspace (git-ignored)
docs/plans/      the three implementation plans
.dkk/            domain model (8 bounded contexts, 7 flows) and ADRs
```

The web app is its own Node process and proxies `/api` and `/static` to the API, so the browser only ever talks to one origin. Everything runs from a single SQLite file and a data directory; no external database or queue.

## Documentation map

| What | Where |
|---|---|
| Domain model (contexts, aggregates, commands, events, flows) | `.dkk/domain/` — run `dkk render` to generate browsable docs under `.dkk/docs/` |
| Architecture decisions | `.dkk/adr/adr-0001.md` … `adr-0013.md` (`dkk adr decisions <id>` shows what governs an item; `adr-0001` scope, `adr-0012` licence, `adr-0013` providers) |
| Deferred work | `docs/BACKLOG.md` |
| Plan 1 — Backend platform (API, data, jobs, media, compositing, deployment) | `docs/plans/01-backend.md` |
| Plan 2 — AI pipeline (agents, workspace, provider adapters, generation engine) | `docs/plans/02-ai-pipeline.md` |
| Plan 3 — Frontend (Next.js launcher, settings, project page, episode studio) | `docs/plans/03-frontend.md` |
| Milestones across the three plans | `docs/plans/README.md` |

## Requirements

- Node.js 22+ and pnpm 12
- No database server: bundled SQLite
- No FFmpeg install: `ffmpeg-static` / `ffprobe-static` are bundled (override with `FFMPEG_BIN` / `FFPROBE_BIN`; Linux arm64 needs a system ffprobe)

## License

[CC BY-NC-SA 4.0](LICENSE). Personal use, learning and non-commercial projects are welcome; modifications and redistribution must keep this licence and credit the authors; commercial use needs written permission from the copyright holders. See `.dkk/adr/adr-0012.md`.
