# generation

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

Provider-agnostic image and video generation. Every generation, whoever asked for it, is a task row with one lifecycle — submitted, dispatched to a provider through an adapter, polled until it settles, persisted to local media and written back to its owner.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Generation task** | One image or video generation request with its owner tags (character, scene or prop for images; shot for videos), provider, model, prompt, parameters, provider task id, result and status. | — |
| **Provider adapter** | A per-provider module that builds the generate request, parses the generate and poll responses and extracts the result URL or inline data. The worker never speaks a provider's dialect directly. | — |
| **Polling profile** | The cadence and budget for polling a task type — images every 5 seconds up to 10 minutes, videos every 10 seconds up to 300 attempts. | — |
| **Reference normalisation** | Turning local media paths into what a provider can consume — compressed data URLs for images, public URLs (via the configured public base URL) for videos and audio. | — |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [GenerationTaskDeleted](GenerationTaskDeleted.md) | A task was removed from history. | `GenerationTask` | taskId (ID) |
| [GenerationTaskDispatched](GenerationTaskDispatched.md) | The provider accepted the request asynchronously and returned a provider task id to poll. | `GenerationTask` | taskId (ID), providerTaskId (string) |
| [GenerationTaskFailed](GenerationTaskFailed.md) | A task ended in failure with a message the creator can act on (for example switch models after a moderation rejection). | `GenerationTask` | taskId (ID), error (string), ownerRef (string) |
| [GenerationTaskSubmitted](GenerationTaskSubmitted.md) | A task row exists in processing state with its resolved service, model, prompt and parameters. | `GenerationTask` | taskId (ID), type (string), provider (string), model (string), ownerRef (string) |
| [ImageGenerated](ImageGenerated.md) | An image task completed and its result is stored locally with a thumbnail; owners attach it. | `GenerationTask` | taskId (ID), localPath (string), characterId (ID), sceneId (ID), propId (ID) |
| [ProviderResultReceived](ProviderResultReceived.md) | The provider reported a finished result — a downloadable URL or inline base64 data — that still has to be persisted locally. | `GenerationTask` | taskId (ID), resultUrl (string), inlineData (string), mimeType (string), durationSeconds (number) |
| [VideoGenerated](VideoGenerated.md) | A video task completed and its clip is stored locally with a poster frame; the owning shot attaches it. | `GenerationTask` | taskId (ID), localPath (string), shotId (ID), durationSeconds (number) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [CompleteGenerationTask](CompleteGenerationTask.md) | Mark the task completed with its provider result URL and the local media path where the result was persisted (plus duration for videos). Raises ImageGenerated or VideoGenerated for owners to write back. | `GenerationWorker` | `GenerationTask` | taskId (ID), resultUrl (string), localPath (string), durationSeconds (number) |
| [DeleteGenerationTask](DeleteGenerationTask.md) | Remove a task from a shot's or asset's generation history (the media file is kept). | `Creator` | `GenerationTask` | taskId (ID) |
| [DispatchGenerationTask](DispatchGenerationTask.md) | Normalise the task's reference material, build the provider request through the adapter, send it, and record either a synchronous result or the provider task id to poll. | `GenerationWorker` | `GenerationTask` | taskId (ID) |
| [FailGenerationTask](FailGenerationTask.md) | Mark the task failed with a creator-readable error (moderation, timeout, provider error, missing configuration). | `GenerationWorker` | `GenerationTask` | taskId (ID), error (string) |
| [FailInterruptedTasks](FailInterruptedTasks.md) | At API startup, mark every task still in processing as failed with a restart message, because the in-memory polling loops died with the previous process. | `Bootstrap` | `GenerationTask` | — |
| [PollGenerationTask](PollGenerationTask.md) | Ask the provider for the status of an asynchronous task according to the type's polling profile; on completion capture the result, on terminal failure fail the task, on budget exhaustion fail with a timeout. | `GenerationWorker` | `GenerationTask` | taskId (ID), attempt (number) |
| [SubmitImageGeneration](SubmitImageGeneration.md) | Create an image generation task for a prompt with optional reference images and canvas size, tagged with its owner (character, scene or prop). Returns the task id at once; processing continues in the background. | `GenerationWorker` | `GenerationTask` | prompt (string), dramaId (ID), characterId (ID), sceneId (ID), propId (ID), size (string), referenceImages (string[]), model (string), imageServiceId (ID) |
| [SubmitVideoGeneration](SubmitVideoGeneration.md) | Create a video generation task for a shot with the prompt, reference images/videos/audio, duration, aspect ratio, resolution and audio flag. Validated against the resolved provider's reference limits before the row is created. | `GenerationWorker` | `GenerationTask` | shotId (ID), dramaId (ID), prompt (string), referenceImageUrls (string[]), referenceVideoUrls (string[]), referenceAudioUrls (string[]), firstFrameUrl (string), lastFrameUrl (string), durationSeconds (number), aspectRatio (string), resolution (string), generateAudio (boolean), seed (number), model (string), videoServiceId (ID) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [DispatchOnSubmit](DispatchOnSubmit.md) | As soon as a task is submitted, dispatch it in the background so the submitting request can return the task id immediately. | GenerationTaskSubmitted | DispatchGenerationTask |
| [PersistProviderResult](PersistProviderResult.md) | When a provider result arrives, store it in local media (media.StoreRemoteFile for a URL, media.StoreInlineImage for base64 — cross-context, see flow GenerationTaskLifecycle), let media derive renditions, then complete the task with the local path so nothing downstream depends on an expiring provider URL. | ProviderResultReceived | CompleteGenerationTask |
| [PollUntilSettled](PollUntilSettled.md) | After an asynchronous dispatch, keep polling on the type's cadence until the provider reports completed or failed, or the attempt/duration budget runs out. | GenerationTaskDispatched | PollGenerationTask |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [GenerationTask](GenerationTask.md) | One image or video generation request and its full lifecycle. Tagged with its owner so results can be written back, and with the provider task id so polling can resume. | SubmitImageGeneration, SubmitVideoGeneration, DispatchGenerationTask, PollGenerationTask, CompleteGenerationTask, FailGenerationTask, DeleteGenerationTask, FailInterruptedTasks | GenerationTaskSubmitted, GenerationTaskDispatched, ProviderResultReceived, ImageGenerated, VideoGenerated, GenerationTaskFailed, GenerationTaskDeleted |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [EpisodeGenerationTasks](EpisodeGenerationTasks.md) | The task drawer of the workbench — every generation task belonging to the episode (through its shots and linked assets) newest first, plus the episode's merges, with elapsed time and owner labels. | GenerationTaskSubmitted, ImageGenerated, VideoGenerated, GenerationTaskFailed, GenerationTaskDeleted | Creator |
| [GenerationTaskStatus](GenerationTaskStatus.md) | One task's current state for polling from the UI — status, error, local result path, provider and model, timestamps. | GenerationTaskSubmitted, GenerationTaskDispatched, ImageGenerated, VideoGenerated, GenerationTaskFailed | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | proposed |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | proposed |
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | proposed |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | proposed |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | proposed |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | proposed |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
