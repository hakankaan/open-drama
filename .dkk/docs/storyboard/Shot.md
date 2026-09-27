# Shot

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [storyboard](index.md)

## Summary

One storyboard segment of an episode. Owns its description, atmosphere, duration, bindings, prompts (image and video), reference media and the current video plus its generation history.



## Rules & Invariants

- shotNumber is unique within the episode; batch saves upsert by shotNumber so retries never duplicate.
- sceneId, characterIds and propIds must belong to the drama; binding an asset not yet linked to the episode links it.
- durationSeconds is between 2 and 30 (agents target 8-15); the episode's derived duration is the sum of live shot durations.
- A video request needs at least one reference asset or a non-empty video prompt.
- The current video is the most recent successful generation unless the creator picks another from history.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `SaveShots` |
| Handles | `CreateShot` |
| Handles | `UpdateShot` |
| Handles | `DeleteShot` |
| Handles | `GenerateShotVideoPrompt` |
| Handles | `RequestShotVideo` |
| Handles | `AttachShotVideo` |
| Emits | `ShotsSaved` |
| Emits | `ShotCreated` |
| Emits | `ShotUpdated` |
| Emits | `ShotDeleted` |
| Emits | `ShotVideoPromptSaved` |
| Emits | `ShotVideoRequested` |
| Emits | `ShotVideoAttached` |

## Linked ADRs

_No linked ADRs._
