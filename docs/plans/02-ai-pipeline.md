# Plan 2 — AI pipeline (agents, workspace, provider adapters, generation engine)

Scope: everything that talks to a model. The agent runtime and its four production agents, the prompt/skill workspace they read from, the text-model transport patches, the unified generation engine, the image and video provider adapters (plus stub adapters for offline development), reference normalisation, result persistence and write-back. It lives inside `apps/api` and plugs into the endpoints and tables defined in Plan 1.

Governing decisions: `adr-0005` (generation lifecycle + adapters), `adr-0006` (AI SDK tool loop, file-based prompts/skills), `adr-0008` (jobs), `adr-0009` (media), `adr-0011` (English canonical), `adr-0001` (original work: every prompt and skill text is written for this repository), `adr-0012` (licence), `adr-0013` (provider set; BytePlus served by the Volcengine adapters, ModelRunner by its queue adapter). Domain: `.dkk/domain/contexts/{agents,generation,assets,storyboard,production}` and flows `AgentRun`, `GenerationTaskLifecycle`.

---

## 1. Goals

1. Four agents that turn raw text into a shot list with prompts, using only tools that read and write the domain — the model never invents ids, and success is judged by what was persisted.
2. Prompts and skills are plain Markdown files a creator can edit from the UI, in English with optional language variants, and every agent run obeys the configured content language.
3. Every image and video generation follows the same lifecycle regardless of provider, with local persistence and write-back to the owning asset or shot.
4. Adding a provider means adding one adapter file; nothing else changes.
5. Works with any OpenAI-compatible or Gemini text endpoint, including relays, without per-user code changes (transport patches for thinking, temperature and output limits).
6. The whole pipeline runs offline against stub adapters so the frontend can be built and demonstrated without keys.

## 2. Behaviour to guarantee

- Agents: `script_rewriter`, `extractor`, `storyboard_breaker`, `prompt_generator`, each with a fixed tool set, run with a step budget (20 for rewrite/extract/breakdown, 8–12 for prompts).
- Instructions = prompt file (language variant → base → built-in default) + full text of every skill under the agent's prefix + a highest-priority language directive when the content language is not the canonical one.
- Model = request override → prompt file frontmatter `model` → the resolved text service's default model; the text service is the request's explicit service or the active one.
- Transport patches on relays: disable thinking (OpenAI-style params or Gemini `thinkingConfig`), send configured temperature, raise `max_tokens` to 16k; skip on official hosts.
- Extraction runs per target type with a target-specific message; dedup by near-name / location+time; props are 0–3 and plot-critical.
- Storyboard breakdown: identify beats, 8–15 s segments with 2–4 sub-shots, duration rules, description with `[Shot N]` blocks and dialogue, `videoPrompt` in 3 s lines with mentions, save in batches of ≤ 8 with `replaceExisting` on the first, upsert by shot number.
- Prompt generator: turnaround sheet / empty establishing shot / white-background product shot specs; style prefix injected by the save tool, never by the model; video prompt header + 3 s segments mapped 1:1 to sub-shots, no invented dialogue.
- Generation: task row `processing` → adapter builds request → sync result or async task id → poll (images 5 s × 120 within 10 min; videos 10 s × 300) → download or decode → thumbnail/poster → write back; terminal provider failures fail immediately; timeouts fail with a message; restart fails all `processing` rows.
- Reference normalisation: local images → compressed JPEG data URLs (≤ 768 px, q68, max 6 for image edits); local videos/audio → `PUBLIC_BASE_URL` + path or a clear error; remote URLs pass through.
- Moderation rejections are surfaced with a hint to switch models.

Design notes: no agent framework (`adr-0006`); English canonical texts and `[Shot N]` markers (`adr-0011`); agent user messages live in the API, not the browser; the mention grammar is `@[Name]` and the provider token is rendered by the adapter, with resolution in `RequestShotVideo` (Plan 1); job state in `agent_jobs` with explicit failure events (`adr-0008`); no server-side batch that chains agent runs; no shot frame images in v1.

## 3. Module map (inside `apps/api/src`)

```
modules/agents/
  runtime/
    run-agent.ts          # runAgent({ agentType, message, episodeId, dramaId, model?, textServiceId?, maxSteps? })
    instructions.ts       # assemble: prompt file + skills + language directive
    model.ts              # resolve text service + model; build AI SDK provider with patched fetch
    transport-patches.ts  # thinking-off, temperature, max-tokens fetch wrappers
    context.ts            # AgentContext { episodeId, dramaId, language, log } passed to every tool
    tool.ts               # defineTool({ id, description, input: zod, execute(input, ctx) }) → AI SDK tool
    logging.ts            # per-step tool call / result logging with redaction
    sdk.ts                # the only file that imports `ai` / `@ai-sdk/*` (pinned majors, see §12)
  agents/
    script-rewriter.ts    # tools + default prompt + message templates
    extractor.ts
    storyboard-breaker.ts
    prompt-generator.ts
    index.ts              # registry: type → { name, tools, defaultInstructions, skillPrefixes, maxSteps }
  tools/
    script.ts             # read_episode_script, save_script
    extract.ts            # read_script_for_extraction, read_existing_{characters,scenes,props}, save_dedup_{…}
    storyboard.ts         # read_storyboard_context, save_shots, update_shot
    image-prompts.ts      # read_{characters,scenes,props}, save_{character,scene,prop}_final_prompt
  workspace/
    files.ts              # jailed fs under WORKSPACE_PATH; copy-once template; language variant resolution
    prompts.ts            # parse/serialize prompt files (frontmatter name/model + body)
    skills.ts             # scan skills/**/SKILL.md, per-agent prefixes, localized variants
  services/
    final-prompt.ts       # ensureCharacter/Scene/PropFinalPrompt(asset, episodeId, force, opts)
    rewrite.ts            # startRewrite(episodeId, opts) via runJob → ScriptRewriteJob
    extraction.ts         # startExtraction(episodeId, target, opts) via runJob
    breakdown.ts          # startBreakdown(episodeId, opts) via runJob (parks shots on the first batch)
    video-prompts.ts      # startVideoPromptBatch(episodeId, shotIds?, opts) via runJob; generateShotVideoPrompt(shotId)
  routes.ts               # /agents/*, /skills/* (Plan 1 table)

modules/generation/
  engine/
    submit.ts             # submitImage(params) / submitVideo(params) → taskId (creates row, dispatches detached)
    dispatch.ts           # build request through adapter, send, sync-complete or start polling
    poll.ts               # polling profiles and loop
    complete.ts           # persist result (media), derive renditions, mark completed, run write-back hooks
    references.ts         # normalizeReferenceImages, normalizeVideoReferences, resolvePublicMediaUrl
    write-back.ts         # hooks: character/scene/prop imagePath; shot videoPath + duration
    errors.ts             # classify provider errors → TaskErrorClass
  adapters/
    types.ts              # ImageProviderAdapter, VideoProviderAdapter, ProviderRequest, records, limits
    registry.ts           # provider name → adapter; supported providers per service type; limitsFor(provider)
    url.ts                # joinProviderUrl(base, requiredPrefix, path)
    stub-image.ts         # offline adapter: writes a generated placeholder PNG after a short delay
    stub-video.ts         # offline adapter: copies a bundled sample clip after a short delay
    openai-image.ts       # /v1/images/generations + /v1/images/edits (multipart)
    gemini-image.ts       # generateContent with inline image output (base64)
    <video>-*.ts          # see §9
  routes.ts               # /generation-tasks (Plan 1 table)

workspace/  (repo root, template copied to $DATA_DIR/workspace)
  prompts/script_rewriter.md  extractor.md  storyboard_breaker.md  prompt_generator.md   (+ .zh.md/.ja.md/.ko.md)
  skills/script-rewriter/SKILL.md
  skills/extractor/SKILL.md
  skills/storyboard-breaker/SKILL.md
  skills/prompt-generator/{character-prompt,scene-prompt,prop-prompt,video-prompt}/SKILL.md
```

## 4. Agent runtime

**`runAgent(input)`** (command `agents.RunAgent`):
1. Validate `agentType` against the registry.
2. Build `AgentContext` from the request (`episodeId`, `dramaId`, content language from `app_settings`, optional overrides) — tools read scope only from this context.
3. `instructions = assembleInstructions(agentType, language)`.
4. `model = resolveModel({ agentType, modelOverride, textServiceId })`.
5. Call the AI SDK text generation (`sdk.ts`) with `system: instructions`, the user `message`, the agent's tools, and the agent's step limit (`stopWhen: stepCountIs(n)` in the current major; the wrapper hides the SDK's naming). Log each step's tool calls (names + redacted args) and the final text.
6. Return `{ text, toolCalls, steps, elapsed }`; raise `AgentRunFailed` on exception. Callers verify the expected side effect themselves (for example `SaveScript` happened), as the domain model states, and retry once with a "you must call the save tool" reminder when the run ended without the expected persistence.

**Instruction assembly**: prompt file for the language (variant → base → built-in default in code) + `## Skills` section listing every `SKILL.md` whose path starts with one of the agent's prefixes (variant body when present) + language directive (empty for `en`; otherwise a block stating that all produced content must be in the target language, that this overrides any other language rule, that existing asset names inside `@[…]` mentions are never translated, and that the style prefix is injected by the system).

**Model resolution and transport patches**: resolve the text service (explicit → active), compute the base URL with the provider's required prefix (`/v1` for OpenAI-style, `/v1beta` for Gemini), then wrap `fetch`: on non-official hosts inject thinking-off parameters (OpenAI-style: `thinking: {type: 'disabled'}`, `enable_thinking: false`, `reasoning_effort: 'none'`, overridable by `OPEN_DRAMA_AI_THINKING_OFF_PATCH`; Gemini: `thinkingConfig` with `thinkingLevel: 'low'` for 3.x models else `thinkingBudget: 0`), always send the configured temperature when set, and on non-official OpenAI hosts set `max_tokens` (`OPEN_DRAMA_AI_MAX_TOKENS`, default 16384). Relays use the OpenAI-compatible provider package. Log the resolved endpoint once per distinct key.

**Tool contract**: `defineTool({ id, description, input: zodSchema, execute(input, ctx) })` returns an AI SDK tool (`inputSchema` in the current major). Tools return plain JSON (including `{ error }` objects rather than throwing, so the model can recover), never mutate anything outside their aggregate, and log start/complete with counts.

**Agent user messages**: kept in the API next to each agent as English templates (rewrite, extract-per-target, breakdown with asset lists, single video prompt, final prompt per asset type). The web app never composes agent prompts.

## 5. The four agents

| Agent | Tools | Message (summary) | Success check |
|---|---|---|---|
| `script_rewriter` | `read_episode_script`, `save_script` | "Read the episode content and rewrite it as a formatted script, then save it." | `episodes.scriptContent` non-empty after the run → `ScriptRewriteCompleted`, else `ScriptRewriteFailed` |
| `extractor` | `read_script_for_extraction`, `read_existing_characters/scenes/props`, `save_dedup_characters/scenes/props` | per target: "Extract only {characters \| scenes \| plot-critical props} from this episode's script; read existing ones first and reuse matches; save with the dedup tool." | job `done`; counts from the save tool logged |
| `storyboard_breaker` | `read_storyboard_context`, `save_shots`, `update_shot` | "Break the script into shots. The video model is {label}. Characters: …(id) Scenes: …(id) Props: …(id). Save in batches of at most 8; the first batch replaces existing shots." | live shots exist for the episode after the run (parked shots purged); `videoPrompt` present (else the batch runs) |
| `prompt_generator` | `read_characters/scenes/props`, `save_*_final_prompt`, `read_storyboard_context`, `update_shot` | (a) "Write the {turnaround \| establishing-shot \| product-shot} final prompt for {asset} (id) and save it." (b) "Write the video prompt for shot #{n} (id) for video model {label}; read the shot context first; save only `videoPrompt`." | the target field is non-empty after the run |

**Skills to author** — English texts in a four-part shape: *what the agent produces* (the artefact and its fields, taken from the aggregate), *how the artefact is judged* (the invariants as acceptance criteria), *worked example*, *tool protocol* (which tool to call, in what order, what a valid call contains). Every text is written from scratch for this repository (`adr-0001`) from the domain glossary and aggregates. Texts use this repository's vocabulary — `[Shot N]` markers, the `@[Name]` mention grammar, `save_shots` / `update_shot` / `shotId` tool names, `durationSeconds` — and follow the invariants stated in the domain model (segment length and sub-shot counts, the dialogue-duration floor, the 0–3 plot-critical prop rule, near-name deduplication, the three reference-image formats, the 3-second line format).

- `script-rewriter`: artefact = formatted script (scene heading line, action paragraphs, dialogue lines with a state cue; 30–60 s per scene; no camera language).
- `extractor`: artefacts = characters (appearance with personality folded in, styling), scenes (set-dressing prompt, lighting), props (name, type, physical description only); acceptance = the ExtractionJob and asset invariants (dedup, episode scope, 0–3 props with the self-check questions).
- `storyboard-breaker`: artefact = shots with `[Shot N]` sub-shot blocks, bindings, durations; acceptance = Shot invariants and the storyboard glossary (beats, 8–15 s, dialogue floor, never cross scenes, batches ≤ 8, first batch replaces).
- `prompt-generator/character-prompt`, `scene-prompt`, `prop-prompt`: artefacts = the three reference-image prompts (turnaround sheet, establishing shot with nobody in it, product shot), style words forbidden (injected on save).
- `prompt-generator/video-prompt`: artefact = header line + one line per 3 s segment mapped 1:1 to sub-shots, `@[Name]` mentions only for bound assets, no invented dialogue, saved through `update_shot` with `shotId` + `videoPrompt` only.

## 6. Workspace

- Template in the repo at `workspace/`; copied once into `$WORKSPACE_PATH` at boot (marker `.template-version`; a newer template only adds files it does not find, never overwrites edits).
- File names: `prompts/<agent>.md`, `prompts/<agent>.<lang>.md`, `skills/<path>/SKILL.md`, `skills/<path>/SKILL.<lang>.md`. `lang ∈ {zh, ja, ko}`; `en` is the base file. `lang` is validated against `ContentLanguage` before any path is built.
- Prompt file = frontmatter (`name`, `model`) + body; `model` is read from the base file only.
- Skill discovery scans directories containing `SKILL.md`; each agent has prefixes (`script-rewriter`, `extractor`, `storyboard-breaker`, `prompt-generator/`); new skill directories created from the UI are picked up on the next run (no cache, or cache invalidated on write).
- All reads and writes go through `workspace/files.ts`, which resolves paths against `WORKSPACE_PATH`, validates skill ids as `[a-z0-9-]+` segments and rejects anything that escapes the root.
- Routes (Plan 1 table): catalog, prompt get/put/reset with `?lang`, skills list/get/create/put/delete with `?lang`.

## 7. Generation engine

**Types**: `submitImage({ prompt, size?, referenceImages?, owner: { characterId | sceneId | propId }, dramaId, model?, imageServiceId? })` and `submitVideo({ prompt, referenceSlots: { name, imageUrl }[], referenceVideoUrls?, referenceAudioUrls?, durationSeconds?, aspectRatio?, resolution?, generateAudio?, seed?, owner: { shotId }, dramaId, model?, videoServiceId? })` → `taskId`.

**Lifecycle** (one function per domain command):
1. `submit` — resolve service (explicit → owner episode lock → active), reject with `409` when the owner already has a processing task of the type, validate provider limits for video (reference counts, audio-needs-visual rule, prompt-or-reference), insert row `processing` with `params` JSON, return id, `dispatch` detached.
2. `dispatch` — load row, normalise references (§8), render mention slots through `adapter.formatMention(slot, name)` (or plain name), `adapter.buildGenerateRequest(config, record)`, `fetch` (JSON or `FormData`, 10 min timeout), `adapter.parseGenerateResponse` → sync result → `complete`; async → store `providerTaskId`, start `poll`.
3. `poll` — profile per type; each attempt `adapter.buildPollRequest` → `parsePollResponse`: `completed` → `complete`; `failed` → `fail` (terminal, no retry); otherwise wait; transport errors retry until attempts or duration are exhausted → `fail('Timeout …', 'timeout')`.
4. `complete` — `media.storeRemoteFile(url, kind)` or `media.storeInlineImage(b64, mime)`, `media.deriveRenditions`, update row (`resultUrl`, `localPath`, `durationSeconds`, `completedAt`), then write-back hooks: image → character/scene/prop `imagePath`; video → shot `videoPath` + duration.
5. `fail` — store the message and `errorClass`; asset and shot rows are left unchanged.
6. Boot: `FailInterruptedTasks` marks all `processing` rows failed with "Interrupted by a restart, please retry" (class `timeout`).

**Error classification** (`errors.ts` → `TaskErrorClass`): `moderation` (provider messages about sensitive, real-person or policy content, and known codes such as `OutputVideoSensitiveContentDetected`), `auth` (401/403), `quota` (429), `timeout`, `config` (missing service, missing public base URL), `provider` (other). The message stored on the task is human-readable and the class is exposed so the UI can show the "switch model" hint.

**Logging**: one structured line per transition with `taskId`, provider, model, owner; request/response payloads at debug level with keys, base64 and URLs redacted.

## 8. Reference normalisation

- Image references (`referenceImages`, video `referenceSlots[].imageUrl`): data URLs pass through; `static/…` paths are read, rotated, resized to fit 768×768, JPEG q68, returned as data URLs; `http(s)` URLs are fetched (30 s timeout) and compressed the same way; deduplicated; image edits capped at 6.
- Video and audio references (Phase F): `http(s)`/`data:` pass through; `static/…` requires `PUBLIC_BASE_URL` and becomes `${PUBLIC_BASE_URL}/static/…`; otherwise the task fails with an actionable `config` error.
- Stored resolution vocabulary: `480p | 720p | 1080p`; adapters map to provider tiers (a provider's "2K" tier is what `1080p` maps to where 1080p does not exist).

## 9. Provider adapters

**Contract** (`adapters/types.ts`):

```ts
interface ImageProviderAdapter {
  provider: string
  buildGenerateRequest(config: ServiceConfig, record: ImageGenerationRecord): ProviderRequest
  parseGenerateResponse(result: unknown): { isAsync: boolean; taskId?: string; imageUrl?: string }
  buildPollRequest(config: ServiceConfig, taskId: string): ProviderRequest
  parsePollResponse(result: unknown): { status: 'pending'|'processing'|'completed'|'failed'; imageUrl?: string; error?: string }
  extractImageUrl(result: unknown): string | null
  extractImageBase64(result: unknown): { data: string; mimeType: string } | null
  probe(config: ServiceConfig): ProviderRequest          // connectivity probe used by TestModelService
}
interface VideoProviderAdapter {
  /* same shape; videoUrl + durationSeconds instead of image */
  limits: { images: number; videos: number; audios: number; audioNeedsVisual: boolean; durationRange: [number, number] }
  formatMention(slot: number, name: string): string        // provider token for reference slot N, or the plain name
}
interface ProviderRequest { url: string; method: string; headers: Record<string,string>; body: unknown | FormData }
```

**Adapters, in delivery order**:
- `stub-image`, `stub-video` (Phase E, first) — registered when `OPEN_DRAMA_STUB_PROVIDERS=1`; produce a placeholder PNG (sharp-generated, prompt text baked in) and a bundled 3 s sample clip after a 2–5 s delay, with a `moderation` failure when the prompt contains `#fail`; they exercise every engine path offline.
- `openai-image` — `/v1/images/generations` for text-to-image, `/v1/images/edits` (multipart `image[]`) when references exist; size normalisation for `gpt-image-*` models; URL or `b64_json` results.
- `gemini-image` — `generateContent` with image response modality; inline base64 output; reference images as `inline_data` parts.
- Video adapters (Phase F), iteration 1, in priority order (`adr-0013`): Seedance 2.x via Volcengine Ark (multimodal `content[]` with reference roles, 4–15 s, 480p/720p, `@Image{N}`-style tokens), MiniMax (768P/2K tiers), Wan 3.x via Alibaba Bailian (`input.media[]` + `parameters`, async header).
- **BytePlus ModelArk** (brought into iteration 1 on 2026-09-29, `adr-0013` amendment): the Volcengine Seedream and Seedance adapters under the ModelArk host, registered as `byteplus`; text through the OpenAI-compatible client. **ModelRunner** (also brought into iteration 1 on 2026-09-29): `modelrunner.ts` drives the Seedream and Seedance families over the queue API (`Authorization: Key`; submit, poll the result path on the service's origin, download), switching between a family's text-only and reference endpoints by whether references are present; text through its OpenAI-compatible `/v1` route.
- Each adapter file owns: required URL prefix, model allow-list or prefix check, parameter mapping (duration clamp, ratio, resolution tier), reference limits (used by `submit` validation through `registry.limitsFor(provider)`), mention token formatting, its probe, and response parsing including moderation error codes.

## 10. Where the pieces plug into Plan 1

- `runJob` wraps rewrite, extraction, breakdown and the prompt batch; every wrapper reports failure explicitly (`ScriptRewriteFailed`, `ExtractionFailed`, `StoryboardBreakdownFailed`, `VideoPromptBatchFailed`); the breakdown wrapper parks and restores shots around the agent run.
- `ensure*FinalPrompt` is called by the asset image endpoints before submitting; on agent failure it returns `''` and the caller falls back to a locally composed prompt (style + fields + format constraints, scenes explicitly "no people").
- `RequestShotVideo` (Plan 1) builds the reference slots and calls `submitVideo`; write-back hooks in `complete.ts` implement the two `Attach…OnGeneration` policies.
- The `/agents/:type/chat` route exposes `runAgent` for debugging and power users.

## 11. Work breakdown

### Phase A — Runtime core + script rewriter (1–2 days)
- `sdk.ts`, `run-agent.ts`, `instructions.ts` (built-in defaults only), `model.ts` with transport patches, `tool.ts`, logging; `script_rewriter` tools; `startRewrite` via `runJob` with the completed/failed outcome; `POST /agents/:type/chat`.
- Done when: with one real text service configured, `POST /episodes/:id/rewrite` on a pasted chapter produces a formatted script visible on `GET /episodes/:id`, the job row is `done`, and a run that ends without calling `save_script` is retried once and then reported `failed`; on a relay that rejects thinking traffic the run still completes.

### Phase B — Extractor (1 day)
- Tools with near-name normalisation (shared helper with Plan 1 assets service), episode linking, merge semantics, empty-props handling; `startExtraction` per target with parallel targets; `/jobs` status.
- Done when: running all three targets on a sample script yields characters/scenes/props linked to the episode; a second run merges (no duplicates); a name with a parenthesised qualifier reuses the existing character.

### Phase C — Prompt generator: final prompts (1 day)
- `read_characters/scenes/props`, `save_*_final_prompt` with style injection and stale-flag clearing; `ensure*FinalPrompt` with the local fallback.
- Done when: `POST /characters/:id/final-prompt` returns a style-prefixed prompt persisted on the character with `finalPromptStale = false`; a scene prompt contains no people.

### Phase D — Workspace files and editing (1 day)
- Author the English prompts and skills from §5 from scratch (`adr-0001`); language variant resolution; copy-once; jailed file access; `/agents` + `/skills` routes; language directive.
- Done when: editing a skill from the API changes the next run's instructions without restart; setting `contentLanguage` to `ja` makes the rewriter output Japanese while keeping existing `@[…]` names intact.

### Phase E — Generation engine + stub and image adapters (1–2 days)
- Engine lifecycle, polling profiles, references, persistence via media, write-back hooks, error classification, boot cleanup; `stub-image`/`stub-video` first, then `openai-image` and `gemini-image` with probes.
- Done when: with `OPEN_DRAMA_STUB_PROVIDERS=1` and no network, character image generation lands a local file with a thumbnail and sets `imagePath`, and a shot video request lands a clip and sets `videoPath`; with each real image adapter the same happens online; a base64-only provider result is handled; killing the process mid-poll leaves the task `failed` after restart.

### Phase F — Storyboard breaker, prompt batch, video adapters (2–3 days)
- `read_storyboard_context`, `save_shots` (batch upsert, parking, binding validation via Plan 1 service; the batch holding the last shot sets `final`, and only then is the breakdown done), `update_shot` with garbage-value filtering (`"null"`, `"undefined"`); `startBreakdown`; `startVideoPromptBatch` (per shot, success by persisted prompt, progress, failure event); `generateShotVideoPrompt`.
- The chosen video adapters with limits, tier mapping and `formatMention`; `submitVideo` validation; `PUBLIC_BASE_URL` resolution and the video/audio upload endpoints; moderation classification.
- Done when: breakdown of a sample script produces ordered shots with bindings and 3-second-line prompts in one job, and killing the API mid-breakdown restores the previous shots; the batch fills only shots with empty prompts; a shot with bound character and scene images produces a clip via a real provider with `@[Name]` mentions rendered in the provider's token syntax; a moderation rejection is stored with the `moderation` class; a local reference video without `PUBLIC_BASE_URL` fails with the actionable message.

### Phase G — Hardening (1 day)
- Timeouts and budgets tuned per provider; redaction audit of logs; retry of transient poll errors; step-budget and truncation diagnostics ("agent finished without saving"); a per-episode cap on concurrent video tasks (configurable, default 4).
- Done when: the whole pipeline runs end to end against the stub adapters with no network, and against real providers with keys, with no unredacted key in the logs.

Estimated total: 9–12 working days.

## 12. Risks and open questions

- **Video providers.** Decided (`adr-0013`): iteration 1 ships the official Seedance (Volcengine), MiniMax and Wan adapters in that order; BytePlus reuses the Seedance adapter under its own host (brought into iteration 1 on 2026-09-29); ModelRunner has its own queue adapter (also iteration 1). The adapter contract makes reordering cheap.
- **AI SDK version drift.** Pin `ai` (v6 line) and `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible` (v3 line); the step-limit (`stopWhen: stepCountIs`) and tool (`inputSchema`) APIs changed between majors. Only `sdk.ts` imports them.
- **Model compliance.** Agents sometimes reply with text instead of calling the save tool; the success check plus a single automatic retry with a stronger "call the tool" reminder covers most cases.
- **Cost control.** Batch video generation is the expensive step; the confirmation dialog (Plan 3), the per-shot `409` while processing, per-shot retry and the concurrency cap are the guardrails.
- **Prompt quality.** Prompt, skill and preset texts are written from the domain model (`adr-0001`); their quality is judged by running the agents against sample scripts, so Phase D and F walkthroughs must include review of the outputs.
