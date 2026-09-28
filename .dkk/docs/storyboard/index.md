# storyboard

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

The breakdown of an episode's script into shots — each shot is one video-generation unit of 8-15 seconds carrying 2-4 sub-shots — plus per-shot video prompts, reference bindings to characters, scenes and props, and the generated shot videos.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Sub-shot** | One visual unit of two to six seconds inside a shot, marked as a [Shot N] block in the description. A shot may switch framing between its sub-shots, but all of them happen in the same scene. | — |
| **Video prompt** | The generation prompt for a shot — a header naming the characters and scene, then one line per 3-second segment. Assets are referenced with the delimited mention grammar @[Name] (brackets allow multi-word names); on generation the API turns each mention into an ordered reference-image slot and the video adapter renders it in the provider's own token syntax. | — |
| **Reference binding** | The characters, scene and props whose reference images are sent with the shot's video request. Extra reference images, videos or audio can be uploaded per shot. | — |
| **Breakdown** | The storyboard-breaker agent run that replaces the episode's shots from the current script, saving in batches of at most 8 with idempotent upsert by shot number. | — |
| **Beat** | A story unit such as the setup, the inciting moment, the climax or a reversal. Two beats never share a shot, so a beat change is always a place where one shot ends and the next begins. | — |
| **Storyboard segment** | What the Shot aggregate represents — one 8-15 second video-generation unit carrying 2-4 sub-shots. | Segment |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [ShotCreated](ShotCreated.md) | A shot was added manually. | `Shot` | shotId (ID), episodeId (ID), shotNumber (number) |
| [ShotDeleted](ShotDeleted.md) | A shot and its bindings were removed. | `Shot` | shotId (ID), episodeId (ID) |
| [ShotUpdated](ShotUpdated.md) | A shot's fields, bindings or reference media changed. | `Shot` | shotId (ID), changedFields (string[]) |
| [ShotVideoAttached](ShotVideoAttached.md) | A generated video is now the shot's current video; the shot counts as generated for the stage rail and the export stage. | `Shot` | shotId (ID), videoPath (string), durationSeconds (number) |
| [ShotVideoPromptSaved](ShotVideoPromptSaved.md) | A video prompt was written to a shot by the agent or the creator. | `Shot` | shotId (ID), source (string) |
| [ShotVideoRequested](ShotVideoRequested.md) | A video generation was requested for a shot with the fully resolved prompt, references and parameters. | `Shot` | shotId (ID), dramaId (ID), prompt (string), videoServiceId (ID), model (string), durationSeconds (number), aspectRatio (string), resolution (string), referenceImageUrls (string[]), referenceVideoUrls (string[]), referenceAudioUrls (string[]) |
| [ShotsSaved](ShotsSaved.md) | A batch of shots was upserted for the episode and the episode's total duration recomputed. | `Shot` | episodeId (ID), count (number), replaced (boolean), totalDurationSeconds (number) |
| [StoryboardBreakdownCompleted](StoryboardBreakdownCompleted.md) | The breaker agent finished and shots were saved; the workbench reloads the shot list. | `StoryboardBreakdown` | episodeId (ID), shotCount (number) |
| [StoryboardBreakdownFailed](StoryboardBreakdownFailed.md) | The breaker agent failed or was interrupted; the shots parked by the first batch are restored, so the episode is back to its pre-breakdown shots and videos. | `StoryboardBreakdown` | episodeId (ID), error (string) |
| [StoryboardBreakdownRequested](StoryboardBreakdownRequested.md) | A breakdown job started for the episode; the storyboard-breaker agent should run. | `StoryboardBreakdown` | episodeId (ID), dramaId (ID), model (string), textServiceId (ID) |
| [VideoPromptBatchCompleted](VideoPromptBatchCompleted.md) | The batch finished with completed and failed counts (a failed shot is one whose prompt stayed empty). | `VideoPromptBatch` | episodeId (ID), completed (number), failed (number) |
| [VideoPromptBatchFailed](VideoPromptBatchFailed.md) | The batch aborted (agent runtime error or restart) before processing every shot; prompts already saved stay, and the creator can start it again for the remaining shots. | `VideoPromptBatch` | episodeId (ID), completed (number), failed (number), error (string) |
| [VideoPromptBatchStarted](VideoPromptBatchStarted.md) | A prompt batch began with the list of shots to process. | `VideoPromptBatch` | episodeId (ID), dramaId (ID), shotIds (ID[]), videoModelLabel (string) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [AttachShotVideo](AttachShotVideo.md) | Record a completed video generation as the shot's current video and duration. Issued by the generation write-back. | `GenerationWorker` | `Shot` | shotId (ID), videoPath (string), durationSeconds (number), taskId (ID) |
| [BreakdownStoryboard](BreakdownStoryboard.md) | Ask the storyboard-breaker agent to split the episode's script into shots with descriptions, atmosphere, durations, bindings and video prompts, replacing the current shots (which are parked until the job succeeds). Runs asynchronously; the UI polls. Returns the running job if one exists. | `Creator` | `StoryboardBreakdown` | episodeId (ID), model (string), textServiceId (ID) |
| [CreateShot](CreateShot.md) | Manually add a shot to an episode with a number, description, duration and bindings. | `Creator` | `Shot` | episodeId (ID), shotNumber (number), title (string), description (string), durationSeconds (number), sceneId (ID), characterIds (ID[]), propIds (ID[]) |
| [DeleteShot](DeleteShot.md) | Remove a shot and its bindings (hard delete; its generation tasks remain in history). | `Creator` | `Shot` | shotId (ID) |
| [GenerateShotVideoPrompt](GenerateShotVideoPrompt.md) | Run the prompt-generator agent for a single shot to write its video prompt from the description (sub-shots and dialogue), atmosphere and duration, then persist it via the agent's update_shot tool (only shotId and videoPrompt). | `Creator` | `Shot` | shotId (ID), model (string), textServiceId (ID) |
| [RequestShotVideo](RequestShotVideo.md) | Generate a video for the shot. Builds the ordered reference list — the bound scene, then bound characters, then bound props (assets without an image skipped), then any extra images supplied in the request — deduplicated and capped by the provider's limit; rewrites each @[Name] mention in the prompt into the matching reference slot (the adapter renders the provider's token syntax, or plain text when the provider has none); prepends the drama's style prompt; applies the episode resolution and the drama aspect ratio; uses the episode's locked video service unless a service or model override is given. Batch generation and retry-failed issue this once per shot, so a shot whose latest video task is still processing is rejected. | `Creator` | `Shot` | shotId (ID), prompt (string), model (string), videoServiceId (ID), durationSeconds (number), extraReferenceImageUrls (string[]), referenceVideoUrls (string[]), referenceAudioUrls (string[]), generateAudio (boolean) |
| [SaveShots](SaveShots.md) | Batch upsert of shots from the agent's save_shots tool (at most 8 per call). The first batch of a breakdown must set replaceExisting, which parks the episode's current shots under the running job id (purged on completion, restored on failure); the batch holding the last shot is marked final; rows are matched by shotNumber; bindings are validated against the drama and auto-linked to the episode; the episode's duration is recomputed. | `AgentRuntime` | `Shot` | episodeId (ID), replaceExisting (boolean), shots (ShotInput[]) |
| [StartVideoPromptBatch](StartVideoPromptBatch.md) | Start filling video prompts for every shot that lacks one, or regenerate the given shot ids. Runs shot by shot in the background; the UI polls progress. Returns the running job (alreadyRunning) if one exists. | `Creator` | `VideoPromptBatch` | episodeId (ID), shotIds (ID[]), model (string), textServiceId (ID) |
| [UpdateShot](UpdateShot.md) | Edit any shot field — description, atmosphere, prompts, duration, camera fields, scene binding, character and prop bindings, uploaded reference media, or pick a different video from history as the current one. | `Creator` | `Shot` | shotId (ID), description (string), atmosphere (string), videoPrompt (string), imagePrompt (string), durationSeconds (number), sceneId (ID), characterIds (ID[]), propIds (ID[]), referenceMedia (ReferenceMedia[]), videoPath (string) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [AttachShotVideoOnGeneration](AttachShotVideoOnGeneration.md) | Triggered by generation.VideoGenerated (cross-context event, see flow StoryboardAndVideoStage) for a task tagged with a shot — attaches the local video path and duration to that shot. | — | AttachShotVideo |
| [RunStoryboardBreaker](RunStoryboardBreaker.md) | When a breakdown is requested, run the storyboard_breaker agent scoped to the episode (agents.RunAgent — cross-context, see flow StoryboardAndVideoStage); it reads script and assets and saves shots in batches through SaveShots. | StoryboardBreakdownRequested | — |
| [RunVideoPromptGenerator](RunVideoPromptGenerator.md) | When a prompt batch starts, run the prompt_generator agent once per shot in shot order (agents.RunAgent — cross-context), telling it the episode's video model, and count success by the persisted prompt. | VideoPromptBatchStarted | — |
| [SubmitShotVideoGeneration](SubmitShotVideoGeneration.md) | When a shot video is requested, submit a video generation task tagged with the shot id carrying the resolved references and parameters (generation.SubmitVideoGeneration — cross-context, see flow StoryboardAndVideoStage). | ShotVideoRequested | — |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [Shot](Shot.md) | One storyboard segment of an episode. Owns its description, atmosphere, duration, bindings, prompts (image and video), reference media and the current video plus its generation history. | SaveShots, CreateShot, UpdateShot, DeleteShot, GenerateShotVideoPrompt, RequestShotVideo, AttachShotVideo | ShotsSaved, ShotCreated, ShotUpdated, ShotDeleted, ShotVideoPromptSaved, ShotVideoRequested, ShotVideoAttached |
| [StoryboardBreakdown](StoryboardBreakdown.md) | A running breakdown job for an episode. Wraps the storyboard-breaker agent run so the workbench can show progress and outcome; at most one per episode at a time. | BreakdownStoryboard | StoryboardBreakdownRequested, StoryboardBreakdownCompleted, StoryboardBreakdownFailed |
| [VideoPromptBatch](VideoPromptBatch.md) | A batch job that runs the prompt-generator agent once per shot to fill missing video prompts (or regenerate selected ones), tracking total, completed, failed and the current shot. | StartVideoPromptBatch | VideoPromptBatchStarted, VideoPromptBatchCompleted, VideoPromptBatchFailed |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [EpisodeShotList](EpisodeShotList.md) | The video-production stage — every shot of the episode in order with description, atmosphere, duration, bound scene/characters/props (with their reference images and readiness), video prompt, current video (with poster), generation status and history, plus the breakdown job state. | ShotsSaved, ShotCreated, ShotUpdated, ShotDeleted, ShotVideoPromptSaved, ShotVideoRequested, ShotVideoAttached, StoryboardBreakdownRequested, StoryboardBreakdownCompleted, StoryboardBreakdownFailed | Creator |
| [VideoPromptBatchStatus](VideoPromptBatchStatus.md) | Progress of the running or last prompt batch for an episode (status, total, completed, failed, current shot). | VideoPromptBatchStarted, ShotVideoPromptSaved, VideoPromptBatchCompleted, VideoPromptBatchFailed | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | accepted |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | accepted |
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | accepted |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
