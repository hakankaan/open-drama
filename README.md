# Open Drama

**An open, self-hostable AI short-drama studio.** Paste a story, and Open Drama takes it through the whole production line: script rewriting, character/scene/prop extraction with consistent reference images, storyboard breakdown into shots, per-shot video generation, and FFmpeg compositing into a finished episode.

Open Drama is built on **Next.js** (web) and **Node.js** (API), with a documented domain model and architecture decisions, and is released under CC BY-NC-SA 4.0 (see `.dkk/adr/adr-0012.md`).

> **Status: iteration 1 complete.** The whole line runs, from raw text to a merged episode film, in four UI languages (the zh/ja/ko catalogs are machine drafts awaiting native review). Real providers still need end-to-end checks with live keys; see `docs/BACKLOG.md`.

## Two ways to use it

Open Drama is one server with two interfaces, and either works without the other.

- **The web studio**: the pages at port 3000, from the first paste to the finished film.
- **Your AI assistant**: the same server speaks MCP at `POST /mcp`, so Claude Code, Claude Desktop, Cursor or any other MCP client can run the story room from a conversation: create a project, write the outline, plan the episodes, write and review the scripts and recaps, and configure providers (never their keys). The assistant gets the same skills a studio user has as slash-commands (`/open-drama:create-story`, `/open-drama:write-episodes`, …). See [Use it from an AI assistant](#use-it-from-an-ai-assistant).

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The API listens on `127.0.0.1:4000` and the web server forwards `/api` and `/static` to it. Data (SQLite, media, agent workspace) lives in `./data`. If port 3000 is taken, run `WEB_PORT=3100 pnpm dev`. Configuration is optional; see `.env.example`.

Requires Node.js 22+ and pnpm 12. No database server is needed, and no FFmpeg install on macOS, Windows or Linux x64. On Linux arm64 the bundled package has no ffprobe: install FFmpeg and set `FFPROBE_BIN=/usr/bin/ffprobe` (the Docker image already does this).

> Open Drama has no user accounts. Anyone who can reach the web port can use the whole tool, including your API keys. Keep it on a private network, or put a reverse proxy with authentication in front.
>
> It answers only to `localhost` and IP addresses (so pages on other sites cannot reach it through DNS tricks), and it refuses changes requested by another site. To open it by a name, such as `studio.lan` or the domain of your reverse proxy, list that name in `OPEN_DRAMA_ALLOWED_HOSTS` (`PUBLIC_BASE_URL`'s name is allowed already).

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
| `OPEN_DRAMA_ALLOWED_HOSTS` | you open Open Drama by a name other than `localhost` or an IP address, such as `studio.lan` or your reverse proxy's domain (comma-separated) |
| `HOST` | only if the API must listen beyond localhost, which it normally should not |
| `OPEN_DRAMA_VIDEO_CONCURRENCY` | how many shot videos one episode generates at once (default 4); the rest wait their turn |
| `OPEN_DRAMA_STUB_PROVIDERS=1` | try the whole flow offline: image and video generation use local placeholders, text uses a scripted model |
| `OPEN_DRAMA_ASSISTANT=0` | turn the assistant endpoint (`/mcp`) off |
| `OPEN_DRAMA_ASSISTANT_TOKEN` | choose the assistant token yourself (32+ characters) instead of the one the server generates and prints at first start |
| `OPEN_DRAMA_WEB_UI=0` | run the API alone, without the web studio, and use it from an assistant (see below) |
| `OPEN_DRAMA_MODELRUNNER_API_KEY` | seed a text, an image and a video service from one ModelRunner key at start, for a server without a studio to paste it into |

## Use it from an AI assistant

The API serves the Model Context Protocol at `POST /mcp`, behind a bearer token the server issues. Open **Settings › Assistant** in the studio (or run `curl http://localhost:4000/api/v1/settings/assistant` on the server) for the endpoint, the token and a ready-made connect command. The token is also printed once to the API's stdout the first time the server starts.

```bash
claude mcp add --transport http open-drama http://localhost:3000/mcp --header "Authorization: Bearer <token>"
```

Then, in Claude Code, `/open-drama:set-up`, `/open-drama:create-story`, `/open-drama:write-episodes`, `/open-drama:adapt-source` and `/open-drama:review-story` walk through the story room with the same guardrails the studio has: every stage is reviewed before the next, nothing saved is replaced or deleted without your word, and every agent run (which bills your text provider) is started on your request. Other MCP clients take the endpoint and the `Authorization: Bearer <token>` header in their settings. The skills are Markdown under `workspace/assistant/` in your data directory and can be edited like the agents' prompts.

**Keys never pass through the assistant.** It can add a provider, but the key is entered by you: in the studio, with `OPEN_DRAMA_MODELRUNNER_API_KEY` in the environment, or with the `PATCH` command the tool shows you, which reads the key from your own terminal. The command is addressed to the API on the server's own machine (only `/mcp` need be reachable from outside), so run it there, or change its address to one that reaches the API.

**API only.** `OPEN_DRAMA_WEB_UI=0` runs the server without the web studio; in Docker the API itself takes the published port 3000 (`OPEN_DRAMA_WEB_UI=0 docker compose up`), outside Docker set `HOST=0.0.0.0` and `PORT` yourself and run `pnpm --filter @open-drama/api start`. An assistant is then the only interface; the one thing it cannot do is paste a key, hence the environment variable and the `PATCH`.

**From outside.** Only `/mcp` asks for the token; `/api` and the pages are still open to anyone who reaches the port. To connect a cloud assistant (claude.ai's custom connectors, a remote Claude Code), expose only `/mcp` through your reverse proxy, set `PUBLIC_BASE_URL` so the server names its public address, and keep the rest private. Rotate the token from Settings › Assistant (or `POST /api/v1/settings/assistant/rotate`) if it ever leaks.

**Claude Code plugin.** `node scripts/build-plugin.mjs` writes `plugins/open-drama/`, a Claude Code plugin whose skills are these same files and whose MCP server entry asks for your server address and token at install (`/plugin marketplace add <this repo>`, then `/plugin install open-drama`); the plugin is a convenience, the MCP prompts above already give Claude Code the same commands.

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
workspace/       agent prompt + skill templates and the assistant skills (copied once into the data directory, then editable)
data/            runtime data: open-drama.sqlite3, static media, writable workspace (git-ignored)
docs/plans/      the implementation plans
.dkk/            domain model (8 bounded contexts, 7 flows) and ADRs
```

The web app is its own Node process and proxies `/api` and `/static` to the API, so the browser only ever talks to one origin. Everything runs from a single SQLite file and a data directory; no external database or queue.

## Documentation map

| What | Where |
|---|---|
| Domain model (contexts, aggregates, commands, events, flows) | `.dkk/domain/` — run `dkk render` to generate browsable docs under `.dkk/docs/` |
| Architecture decisions | `.dkk/adr/adr-0001.md` … `adr-0016.md` (`dkk adr decisions <id>` shows what governs an item; `adr-0001` scope, `adr-0012` licence, `adr-0013` providers, `adr-0016` the assistant interface) |
| Deferred work | `docs/BACKLOG.md` |
| Plan 1 — Backend platform (API, data, jobs, media, compositing, deployment) | `docs/plans/01-backend.md` |
| Plan 2 — AI pipeline (agents, workspace, provider adapters, generation engine) | `docs/plans/02-ai-pipeline.md` |
| Plan 3 — Frontend (Next.js launcher, settings, project page, episode studio) | `docs/plans/03-frontend.md` |
| Plan 4 — Story development (story writer, episode planner, episode writer) | `docs/plans/04-story-development.md` |
| Plan 5 — Assistant access (MCP endpoint, token, assistant skills, API-only shape, plugin) | `docs/plans/05-assistant-access.md` |
| Milestones across the plans, and the studio ↔ assistant parity inventory | `docs/plans/README.md` |

## Requirements

- Node.js 22+ and pnpm 12
- No database server: bundled SQLite
- No FFmpeg install: `ffmpeg-static` / `ffprobe-static` are bundled (override with `FFMPEG_BIN` / `FFPROBE_BIN`; Linux arm64 needs a system ffprobe)

## License

[CC BY-NC-SA 4.0](LICENSE). Personal use, learning and non-commercial projects are welcome; modifications and redistribution must keep this licence and credit the authors; commercial use needs written permission from the copyright holders. See `.dkk/adr/adr-0012.md`.
