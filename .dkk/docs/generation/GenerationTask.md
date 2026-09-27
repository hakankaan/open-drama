# GenerationTask

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [generation](index.md)

## Summary

One image or video generation request and its full lifecycle. Tagged with its owner so results can be written back, and with the provider task id so polling can resume.



## Rules & Invariants

- status moves processing → completed | failed and never back; a completed task always has a local result path.
- The service used is the explicitly requested one, else the owner episode's locked service, else the highest-priority active service of the type; a disabled locked service falls back rather than blocking.
- Video resolution is stored in the project's own vocabulary (480p / 720p / 1080p) and mapped to the nearest provider tier by each adapter.
- Provider failures that are terminal (moderation, invalid input) fail the task immediately; transport errors retry until the polling budget is exhausted.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `SubmitImageGeneration` |
| Handles | `SubmitVideoGeneration` |
| Handles | `DispatchGenerationTask` |
| Handles | `PollGenerationTask` |
| Handles | `CompleteGenerationTask` |
| Handles | `FailGenerationTask` |
| Handles | `DeleteGenerationTask` |
| Handles | `FailInterruptedTasks` |
| Emits | `GenerationTaskSubmitted` |
| Emits | `GenerationTaskDispatched` |
| Emits | `ProviderResultReceived` |
| Emits | `ImageGenerated` |
| Emits | `VideoGenerated` |
| Emits | `GenerationTaskFailed` |
| Emits | `GenerationTaskDeleted` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | proposed |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | proposed |
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
