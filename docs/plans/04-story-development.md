# Plan 4 — Story development (outline, episode plan, episode writer)

Scope: the layer above the per-episode pipeline. Today an episode starts from pasted raw content. This plan adds three agents that write the story itself: a **story writer** that turns the project's premise into a story outline, an **episode planner** that splits the outline into episodes with beat sheets, and an **episode writer** that expands one episode's beats into the formatted script. Everything below the script (recap, extraction, breakdown, video, export) is untouched.

Governing decisions: `adr-0006` (agents on the AI SDK tool loop, file-based prompts and skills), `adr-0008` (in-process, database-backed jobs), `adr-0011` (English canonical, language variants), `adr-0014` (series continuity through recaps), `adr-0001` (every prompt and skill text is original). New: **`adr-0015` — Story development agents** (this plan's §2 is its decision text). Domain: `.dkk/domain/contexts/{production,agents}` plus a new flow `StoryDevelopment`.

**Sequencing.** The episode-length-target work (`episodes.targetDurationSeconds`, `videoPromptStale`, migration `0003`) is in the working tree and not yet committed. This plan builds on it (the planner writes a target onto every episode it creates; the writer's message reuses the rewrite's length brief) and must land **after** it. No file of that change is touched until it is committed.

**Review.** Codex critiqued the first draft (2026-10-08). Accepted: the drama-scoped duplicate check must include the drama; "fill empty episodes" was dropped as destructive; the planner's per-batch write is one transaction through a shared episode insert; per-job planner state lives in the job's progress row, not in memory; the workspace version is bumped per phase; skip-rewrite and beat edits are refused while a write runs; the debugging chat route gets a scope branch; two partial indexes instead of a `coalesce` expression; the shared script-format skill lives under the rewriter's prefix so it stays visible in Settings; the writer's read tool does not return the old script; the proofs in §5 cover the races. Rejected: feeding recent script text to the planner when a written episode has no recap (the gap is named as `missing`, as the series block does, and the plan dialog shows the recap counts; scripts are too large for the planner's context).

---

## 1. Goals

1. A creator with nothing but a title and a synopsis gets a whole serial written: outline → episodes with beats → scripts, each step reviewable and editable before the next.
2. Every new capability is an agent in the existing shape — a prompt file, a skill, a fixed tool set, a job the studio polls — so it shows up in Settings › Agents with language variants and a model override, and its success is judged by what was persisted.
3. Mid-series use works: the planner continues after the episodes already written, and the story writer respects what has been shot.
4. Nothing destructive. The planner only adds episodes; the writer replaces a script only after the same confirmation the rewrite asks for; the outline is replaced only on a successful save.
5. The agents already in the pipeline get forward context: the outline joins the `series` block, so the rewriter, breaker and recap writer know where the story is going, not only where it has been.

## 2. Decisions (ADR-0015)

- **Three agents, not one.** `story_writer` (drama-scoped), `episode_planner` (drama-scoped), `episode_writer` (episode-scoped). One showrunner agent was rejected: 16k output tokens on relays cannot hold an outline plus sixty beat sheets, the creator wants to edit the outline before it is split, and one job key cannot name two very different failures. Stretching the rewriter into an "expand" mode was rejected: its prompt file promises never to invent, and creators edit those files per persona.
- **The outline is a drama field.** `dramas.outline`, Markdown, at most 20 000 characters, editable on a Story tab of the project page. No structured story model (cast table, arcs): a text the creator can rewrite freely is the artefact; structure lives in the skill that tells the agent what sections to write.
- **The planner creates real episodes.** Each with a title, a one-line synopsis (`episodes.description`) and a beat sheet (`episodes.content`), numbered after the last live episode, with the resolution, target length and locked services the plan dialog chose. The project page is the review surface; deleting an unwanted episode is one click. A reviewable plan object with an "apply" step was rejected as a second data model for the same thing.
- **The planner is append-only.** It never writes into an existing episode, empty or not: an episode the creator added by hand keeps its title, status, resolution, target and locks. Every live episode is given to it as context (recap for written ones, beats for planned ones, "empty" for the rest) so the plan continues from them. "Replace the unplanned episodes" is deferred to the backlog.
- **The writer writes the script directly** through the existing `save_script`, so the recap chain (`WriteRecapAfterScript`) runs unchanged. Writing prose into `content` and then rewriting was rejected: two passes for one artefact, and the beat sheet in `content` is the source the creator edits.
- **Jobs and agent runs become drama- or episode-scoped.** `agent_jobs.episodeId` becomes nullable; a drama-scoped job has none. A running job is unique per (kind, drama, episode, target), enforced by two partial indexes (one for drama-scoped rows, one for episode-scoped rows) and by the duplicate lookup in `runJob`, which now always filters on the drama. Each job kind has a fixed scope that `runJob` asserts. The agent context splits into a drama context and an episode context that extends it; every existing tool keeps its type. A sentinel episode id was rejected.
- **The outline joins the `series` block** for every agent that reads it, whole; the block's character budget rises to 60 000 and still drops only recaps, oldest first. Non-serial dramas get the outline too (an anthology still has a world and a recurring cast).
- **The writer also gets the next episode's beats** (serial dramas only), so a cliffhanger lands where the plan put it and nothing is resolved early.

Consequences: `AgentType` gains three values and `JobKind` three (`adr-0007` enum tables); `adr-0008`'s "one active job per (kind, episode, target)" becomes per (kind, drama, episode-or-none, target); the workspace template moves from v3 to v6 over the phases; projects created before this decision have an empty outline and lose nothing.

Deferred (backlog): replace-unplanned re-planning; seeding the cast (characters) from the outline before episode 1; parsing the outline's suggested episode count into the plan dialog; content-addressed upgrade of unedited built-in prompt and skill files (already listed).

## 3. Behaviour to guarantee

**Story writer** (`story_writer`, job kind `outline`, drama-scoped)
- Reads the premise (title, synopsis, genre, tags, serial) and the current outline as draft notes, plus every live episode with its state (`written` with its recap flagged ready, stale or missing; `planned` with its synopsis; `empty`) so a rewrite respects what exists.
- Writes one outline following its skill: logline; cast (name, role, want, arc); world and tone; the story in acts with its turns and ending; **season shape** (suggested episode count and length, which the creator reads into the plan dialog); for a serial drama, the threads that carry across episodes.
- Saves with `save_outline` (200–20 000 characters), once. The outline is replaced only on save; a failed run keeps the old one.
- One outline job per drama; a duplicate start returns the running job. The creator's outline edit (`PATCH /dramas/:id` with `outline`) is refused with 409 while it runs. The plan job is refused with 409 while it runs.

**Episode planner** (`episode_planner`, job kind `plan`, drama-scoped)
- Request: `count` (1–50), `targetDurationSeconds` (optional, `EpisodeTarget`), `resolution` (default 720p), optional `imageServiceId`/`videoServiceId`, optional text model override.
- Preconditions at start (same wording as `CreateEpisode`): an active image and video service; an outline or a synopsis; no outline job running (409); a running plan is returned (`alreadyRunning`). The request (count, target, resolution, the resolved service ids) is written to the job's `progress` at start, with `written: []`; that row is the job's state, so a restart or a second process reads the same thing.
- Reads: the premise and outline; the request (count, target per episode, total seconds = count × target, the number the first new episode will get); every live episode with its state — `written` (recap ready or stale, or `missing` with its synopsis), `planned` (synopsis, and the beats in full for the last three planned ones), `empty`.
- Saves with `save_episodes` in batches of at most 8, each item `{ title, synopsis, beats }`: title ≤ 120, synopsis ≤ 2000, beats 200–6000 characters, ending on the hook into the next episode. One transaction per batch: the next numbers are taken inside it and the rows are inserted complete (title, synopsis, beats, resolution, target, locked services) through the same `insertEpisode(tx, …)` that `createEpisode` uses; the new ids are appended to `progress.written` in the same transaction. The tool returns the numbers it wrote and how many remain. It refuses items beyond `count`. `final: true` is accepted only once exactly `count` of the written ids are still live (a deleted one is not counted, and the tool says so); the job is done only then.
- A failed or interrupted plan keeps the episodes it created (they hold real beats); `progress.written` says how many of `count` were planned, and the Episodes tab shows it; a new plan for the rest continues from them. No parking, no restore.
- A manual Add episode during a plan is allowed: numbers are taken per batch inside a transaction, so nothing collides; the plan continues after the new one.

**Episode writer** (`episode_writer`, job kind `write`, episode-scoped)
- Precondition: `content` (the beats) non-empty. The script has one agent at a time: a write is refused with 409 while a rewrite runs and a rewrite while a write runs; a breakdown is refused while either runs; `skipRewrite`, the creator's script edit **and the creator's content edit** are refused while either runs (the `updateEpisode` guard, extended: today only the script edit during a rewrite is refused, and the skip and the content are unguarded).
- Reads: number, title, synopsis, beats, whether a script already exists (not its text: the writer replaces it), the target length, the `series` block (premise, outline, earlier recaps) and, for a serial drama, the next live episode's title, synopsis and beats when it has them.
- Writes the formatted script (the shared script-format skill) expanding the beats into scenes within the target length, continuous with the earlier recaps, stopping where the beats stop; saves with `save_script` once. Then `maybeStartRecap`, exactly as after a rewrite.
- Success: `save_script` succeeded (the `runAgentUntilSaved` retry applies).

**Series block** (`adr-0014`, extended)
- `outline` is attached whole when non-empty, for serial and non-serial dramas. Budget 60 000 characters over the serialized block; only recaps are dropped, oldest first, as today.

**Studio and project page**
- Project page gains a **Story** tab: outline editor (save; the agent's write or rewrite with the rewrite-style confirmation; running and failed states), a **Plan episodes** button opening a dialog (count, episode length with the same control as the episode-length button, resolution, the lock note, "continues after episode N", and the earlier-recaps line the rewrite panel shows, so missing recaps are named before planning). While a plan runs, the Episodes tab shows "Planning episodes: 4 of 10" from the job's progress and the list refreshes as batches land; a failed plan shows "Planned 4 of 10" with the error. Episode cards show the synopsis when present.
- Script stage, no script yet: "Write the script" (rewriter, as now), "Expand the beats into a script" (writer) and "Use raw content as the script". With a script: "Rewrite again" and "Expand again", both behind the existing confirmation. The raw-content hint mentions beat sheets.
- Settings › Agents: the agents tab's per-agent prefix map (`agents-tab.tsx`) gains the three agents; the shared script-format skill lives at `script-rewriter/format` so it is listed under the rewriter.

**Debugging chat** (`POST /agents/:type/chat`): `episodeId` optional; a drama-scoped agent validates the drama only, an episode-scoped one requires an episode of that drama.

**Stub provider**: the scripted stub text model answers the three new agents (an outline from the premise; `count` beat sheets from the outline; a script from the beats), so the whole flow runs offline.

## 4. Changes by layer

### 4.1 Contracts (`packages/contracts`)
- `common.ts`: `AgentType` + `story_writer | episode_planner | episode_writer`; `JobKind` + `outline | plan | write`; `JOB_SCOPE: Record<JobKind, 'drama' | 'episode'>`.
- `production.ts`: `OUTLINE_MAX_CHARS = 20_000`; `DramaDetail` + `outline`; `UpdateDrama` + `outline` (trimmed, max); `PlanEpisodes` request; `SeriesContext` + `outline?`; `EpisodeSummary` keeps `hasContent` (the card's "planned" state) and the card shows `description`.
- `jobs.ts`: `AgentJob.episodeId` nullable; `EpisodeJobs` + `write`; new `DramaJobs { dramaId, outline, plan }`; the plan job's `progress` shape `{ count, targetDurationSeconds, resolution, imageServiceId, videoServiceId, written: number[], steps?, model? }` is documented there.
- `agents.ts`: `RunAgentRequest.episodeId` optional.

### 4.2 Database (`apps/api/src/db`, migration `0004_story_development`)
- `dramas.outline text NOT NULL DEFAULT ''`.
- `agent_jobs.episode_id` nullable; the running-uniqueness index becomes two partial indexes: `(kind, drama_id, target) WHERE status = 'running' AND episode_id IS NULL` and `(kind, drama_id, episode_id, target) WHERE status = 'running' AND episode_id IS NOT NULL`; plus an index on `drama_id`. SQLite recreates the table for the nullability change; generate with drizzle-kit, review the SQL, and run it against a copy of `data/preview` checking the row count and the indexes before the first boot.

### 4.3 Jobs (`modules/jobs`)
- `JobKey.episodeId: number | null`; `runJob` asserts `JOB_SCOPE[kind]` matches (a drama kind with an episode, or an episode kind without one, is a programming error) and the duplicate lookup filters on kind, **drama**, episode (`isNull` for drama-scoped keys) and target.
- `getDramaJobs(dramaId)` → `DramaJobs` (latest `outline` and `plan` job of the drama); `getEpisodeJobs` adds `write`.
- Boot cleanup: unchanged (every running job is failed with the restart message); nothing to restore for the three new kinds, and a plan's `progress.written` survives.

### 4.4 Agent runtime (`modules/agents/runtime`)
- `context.ts`: `DramaAgentContext { agentType, dramaId, language, log, jobId? }` and `AgentContext extends DramaAgentContext { episodeId, target?, scriptRevision? }` (the existing name keeps the episode shape, so no existing tool changes).
- `tool.ts`: `defineTool` takes `scope: 'drama' | 'episode'` (default `episode`); a drama-scoped tool's `execute` receives a `DramaAgentContext`. A drama-scoped agent may only carry drama-scoped tools, checked once when the tool registry is built at boot.
- `definitions.ts`: `AgentDefinition.scope`; `RunAgentInput.episodeId` optional; `runAgent` builds the context per scope and refuses an episode-scoped agent without an episode id. The `episode_writer` prefixes are `['episode-writer', 'script-rewriter/format']`.
- Budgets: `story_writer` 8 steps, `episode_planner` 20, `episode_writer` 10.

### 4.5 Tools (`modules/agents/tools`)
- `story.ts`: `read_story`, `save_outline` (drama-scoped).
- `plan.ts`: `read_story_for_planning`, `save_episodes` (drama-scoped). The tool reads and updates the job's `progress` row inside the batch transaction; `planFinished(jobId)` reads `progress.final`. No module-level map.
- `write.ts`: `read_episode_for_writing` (episode-scoped); the writer reuses `save_script` from `script.ts`.
- `index.ts`: the three tool sets.

### 4.6 Services (`modules/agents/services`)
- `outline.ts`: `startOutline(dramaId, opts)` → `runJob({ kind: 'outline', dramaId, episodeId: null })`, `runAgentUntilSaved(…, 'save_outline')`.
- `plan.ts`: `startPlan(dramaId, request)`: preconditions, the request written to progress, then `runJob({ kind: 'plan', … })` with `runAgentUntilDone(…, () => planFinished(jobId), 'saving the final batch of episodes (final: true)')`; on an exception after the final batch keep the result (the breakdown's rule).
- `write.ts`: `startWrite(episodeId, opts)`: preconditions and guards, `runJob({ kind: 'write', … })`, `runAgentUntilSaved(…, 'save_script')`, then `maybeStartRecap`. The message carries the same length brief the rewrite message carries for a target (from the target-length work) and the series note.
- `rewrite.ts`, `breakdown.ts`: refuse while a `write` job runs (409).

### 4.7 Production (`modules/production`)
- `series.ts`: `seriesContext` takes `{ dramaId, beforeEpisodeNumber?: number }` (no bound: every live episode, for the planner and the story writer); attaches `outline`; budget 60 000.
- `dramas.ts`: `outline` in `DramaDetail`; `updateDrama` refuses `outline` while an outline job runs.
- `episodes.ts`: `insertEpisode(tx, values)` (next number + insert, shared by `createEpisode` and the planner batch); `updateEpisode` refuses `content` and `scriptContent` while a rewrite or write runs; `skipRewrite` refuses likewise; `episodeStates(dramaId)` (`written | planned | empty` with recap status) shared by the three read tools.
- `routes.ts`: `POST /dramas/:id/outline`, `POST /dramas/:id/plan`, `GET /dramas/:id/jobs`, `POST /episodes/:id/write`.

### 4.8 Workspace template (`workspace/`)
- Prompts: `story_writer.md`, `episode_planner.md`, `episode_writer.md`.
- Skills: `story-writer/SKILL.md` (the outline: sections, how it is judged, example, tool protocol); `episode-planner/SKILL.md` (the beat sheet: what it holds, the hook rule, sizing beats to the target — about one scene per 45 s, dialogue 1 s per 3 words — batches and `final`); `episode-writer/SKILL.md` (expanding beats into scenes within the length, what may be invented and what may not, continuity with the recaps and the next episode's beats).
- **Shared script format.** The layout part of `skills/script-rewriter/SKILL.md` (heading line, action paragraphs, dialogue lines, the example) moves to `skills/script-rewriter/format/SKILL.md`; `script-rewriter/SKILL.md` keeps the faithfulness rules (every source event, in order, nothing invented). The rewriter's prefix `script-rewriter` covers both; the writer lists `script-rewriter/format` as a secondary prefix, like the breaker lists `prompt-generator/video-prompt`; Settings shows it under the rewriter. Existing workspaces keep their unsplit rewriter skill and gain the new file (copy-once, `adr-0006`), so the rewriter there reads the layout twice but never a contradiction.
- **Versioning.** `ensureWorkspace` returns early once the marker matches, so a phase that adds files must bump the version: v4 in Phase 1 (writer files and the format split), v5 in Phase 3 (story writer), v6 in Phase 4 (planner).
- Every text is written for this repository from the domain glossary (`adr-0001`).

### 4.9 Web (`apps/web`)
- `features/production/api.ts`: `useDramaJobs(id)` (poll 2.5 s while running; when a plan job's `progress.written` grows, invalidate the drama detail), `useStartOutline`, `useStartPlan`, `useStartWrite`; `EpisodeJobs` polling includes `write`.
- `project-page/story-tab.tsx`: outline editor + actions; `plan-episodes-dialog.tsx`; the project page's tab list gains `story`; `episodes-tab.tsx` shows the planning line and the synopsis on cards.
- `studio/script-stage.tsx`: the writer's actions beside the rewrite's; `use-settle-refresh.ts` watches `write`.
- `features/agents/agents-tab.tsx`: the prefix map gains the three agents.
- `messages/en.json` plus zh/ja/ko drafts (machine drafts, native review stays in the backlog as before).

### 4.10 Domain and docs
- `dkk new adr "Story development agents"` → `adr-0015`; `dkk add` for: aggregates `OutlineJob`, `EpisodePlanJob`, `EpisodeWriteJob`; commands `WriteOutline`, `SaveOutline`, `PlanEpisodes`, `AddPlannedEpisodes`, `WriteEpisodeScript`; events `OutlineRequested`, `OutlineSaved`, `OutlineCompleted`, `OutlineFailed`, `EpisodePlanRequested`, `PlannedEpisodesAdded`, `EpisodePlanCompleted`, `EpisodePlanFailed`, `EpisodeWriteRequested`, `EpisodeWriteCompleted`, `EpisodeWriteFailed`; policies `RunStoryWriter`, `RunEpisodePlanner`, `RunEpisodeWriter`; read model `DramaJobs`; glossary `Story outline`, `Beat sheet`; flow `StoryDevelopment` in `index.yml`. `Drama` gains the `outline` invariant, `Episode` the "planned" state wording and the one-agent-at-a-time script rule, `SeriesContext` the outline, `AgentRun` the scope invariant, `RunAgent` the optional episode. `dkk adr link adr-0015 …`, amendments to `adr-0007` (enums) and `adr-0008` (job key and scope), `dkk render`.
- Plans 01/02/03 get the new endpoints, agents and screens; `docs/plans/README.md` gets a row **M6 Story development**; `docs/BACKLOG.md` gets the deferred items of §2.

## 5. Phases

Each phase ends with the walkthrough named under it on the stub preview pair (`stub-preview`, `data/preview`), with the relevant 409s and refusals checked with curl; `pnpm typecheck` and `pnpm lint` must pass before a phase is called done.

**Phase 0 — Decision and domain.** ADR-0015, domain items, links, `dkk render`. No code.

**Phase 1 — Episode writer.** Contracts (`AgentType`, `JobKind`, `JOB_SCOPE`, `EpisodeJobs.write`), tool, service, route, the one-agent-at-a-time guards (rewrite, write, breakdown, skip, content and script edits), workspace v4 with the format split, stub replies, the script-stage actions, settle-refresh, the agents-tab prefix map. No schema change.
Proof: an episode with beats typed by hand → Expand → script saved → recap job runs, and a later stale recap is refused and replaced by the new revision's recap (the `adr-0014` rule still holds). A second Expand asks for confirmation. During a write: Expand again returns `alreadyRunning`; rewrite, skip, a content edit and a script edit return 409; during a rewrite, Expand returns 409. The format skill shows under the rewriter in Settings and the writer's run log lists it. A v3 workspace upgraded to v4 gains exactly the new files and keeps an edited rewriter skill.

**Phase 2 — Drama-scoped runtime.** Migration `0004` (outline column, nullable job episode, the two partial indexes, the drama index), `JobKey` with the scope assertion and the drama-aware duplicate lookup, `DramaJobs` + route, context and tool scopes, the chat route's scope branch, `seriesContext` with the bound and the outline.
Proof: the migration applied to a copy of `data/preview` (row count unchanged, both indexes present) and to a fresh data dir; the existing jobs still start, settle and refuse duplicates; the series block of an existing episode carries an empty outline and the same recaps.

**Phase 3 — Story writer.** Tools, service, route, `updateDrama` guard, workspace v5, stub, the Story tab.
Proof: a project with a synopsis → Write outline → outline saved and shown; an outline edit during the job 409; Rewrite outline asks for confirmation; the rewriter's `read_episode_script` result shows the outline in `series`. Two projects start outline jobs at once and both run; the same project started twice returns `alreadyRunning`. A plan started during an outline job returns 409.

**Phase 4 — Episode planner.** Tools with progress-row state, service with preconditions, route, workspace v6, stub, the plan dialog and progress line, synopsis on cards.
Proof: plan 3 episodes of 45 s on a project that already has one hand-made empty episode → episodes 2, 3 and 4 created with beats, synopsis, 45 s target, 720p and locked services; episode 1 untouched; the job is done only after `final`. `final` sent early is refused naming the shortfall; a second `final` after it is accepted and idempotent. Deleting a planned episode while the plan runs makes `final` refuse until one more is written. A plan of 2 more continues at 5 with the beats of 2–4 in its context; Expand episode 2 → script → recap; Expand episode 3 reads episode 2's recap and episode 4's beats (visible in the agent log). A plan started without an active video service is refused with the `CreateEpisode` wording. A server restart mid-plan fails the job, keeps the episodes created so far and the Episodes tab shows "Planned 1 of 3".

**Phase 5 — Docs and live check.** Plans, README milestone, BACKLOG, i18n drafts. Then, with the owner's consent, one live run on the ModelRunner text model (pennies): outline → plan 2 episodes of 45 s → write both → recaps, on `data/live`.

Codex checkpoints (high importance: a new module, a schema change and a job-key change): the plan (done, 2026-10-08) and the finished diff before Phase 5.

## 6. Risks and open points

- **Table recreation for `agent_jobs`.** SQLite rebuilds the table to make a column nullable; the migration is reviewed by hand and tried on a copy first. The table only holds job history.
- **The planner and output limits.** Eight beat sheets of up to 6000 characters is near a relay's 16k-token limit; the skill asks for 200–1500 characters per beat sheet and the tool accepts up to 6000. If a model still overruns, the batch size drops to 4 (one constant).
- **Old workspaces** keep the unsplit rewriter skill (copy-once). The duplicate layout text is harmless; the content-addressed upgrade stays in the backlog.
- **Length without a target.** With no `targetDurationSeconds`, the planner sizes beats to the outline's season shape and the writer follows the beats; the breakdown then follows the script as today.
- **Missing recaps before a plan.** A written episode without a recap reaches the planner as `missing` with its synopsis only; the dialog names the count so the creator can write them first. Feeding script text to the planner was rejected for size.
