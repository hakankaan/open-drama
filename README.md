# Open Drama

**An open, self-hostable AI short-drama studio.** Paste a story, and Open Drama takes it through the whole production line: script rewriting, character/scene/prop extraction with consistent reference images, storyboard breakdown into shots, per-shot video generation, and FFmpeg compositing into a finished episode.

Open Drama is built on **Next.js** (web) and **Node.js** (API), with a documented domain model and architecture decisions, and is released under CC BY-NC-SA 4.0 (see `.dkk/adr/adr-0012.md`).

> **Status: planning.** This repository currently holds the domain model, the architecture decisions and three implementation plans. No application code has been written yet.

---

## What it does

```
Raw content  ──►  Script  ──►  Assets  ──►  Storyboard & Videos  ──►  Merge & Export
(novel, outline)  AI rewrite   characters    shots · prompts ·        FFmpeg concat
                               scenes        reference-guided         → episode film
                               props         video generation
```

- **Script stage** – paste a novel chapter or outline; the script-rewriter agent turns it into a formatted shooting script (or skip the rewrite).
- **Assets stage** – the extractor agent pulls characters, scenes and plot-critical props out of the script, deduplicated across the whole drama. Each asset gets an AI-written final prompt and a reference image (turnaround sheet, empty establishing shot, white-background product shot). Upload your own images instead if you prefer.
- **Storyboard & video stage** – the storyboard-breaker agent splits the script into 8–15 s shots with sub-shot descriptions, bindings and video prompts. Review prompts with `@mentions` of your assets, pick the video model and resolution, generate shot videos singly or in batch, retry failures.
- **Merge & export** – select shots, let FFmpeg concatenate them into the episode film, play, download, mark done.
- **Bring your own models** – text, image and video providers are configured in the UI: the official endpoints of the supported model families (OpenAI, Gemini, Volcengine Seedance, MiniMax, Alibaba Wan), with BytePlus and ModelRunner adapters following in iteration 2. Keys live in the local database, never in files.
- **Editable agents** – every agent's system prompt and skills are Markdown files you can edit from Settings, with per-language variants.

## Architecture (planned)

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
| Deferred work (iteration 2: BytePlus and ModelRunner adapters) | `docs/BACKLOG.md` |
| Plan 1 — Backend platform (API, data, jobs, media, compositing, deployment) | `docs/plans/01-backend.md` |
| Plan 2 — AI pipeline (agents, workspace, provider adapters, generation engine) | `docs/plans/02-ai-pipeline.md` |
| Plan 3 — Frontend (Next.js launcher, settings, project page, episode studio) | `docs/plans/03-frontend.md` |
| Milestones across the three plans | `docs/plans/README.md` |

## Requirements (planned)

- Node.js 20+ (22 LTS recommended) and pnpm 9+
- No database server: bundled SQLite
- No FFmpeg install: `ffmpeg-static` / `ffprobe-static` are bundled (override with `FFMPEG_BIN` / `FFPROBE_BIN`)

## License

[CC BY-NC-SA 4.0](LICENSE). Personal use, learning and non-commercial projects are welcome; modifications and redistribution must keep this licence and credit the authors; commercial use needs written permission from the copyright holders. See `.dkk/adr/adr-0012.md`.
