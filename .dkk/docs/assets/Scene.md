# Scene

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [assets](index.md)

## Summary

A location at a time period with a set-dressing prompt and lighting, a final establishing-shot prompt and a reference image that contains no people.



## Rules & Invariants

- location is required; identity is normalised location plus time, so the same place at another time of day is a different scene.
- The final prompt and the fallback prompt both forbid people in the scene image.
- Changing the description or lighting keeps finalPrompt but sets finalPromptStale; an explicit finalPrompt in an update always wins and clears the flag.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateScene` |
| Handles | `UpdateScene` |
| Handles | `DeleteScene` |
| Handles | `SaveExtractedScenes` |
| Handles | `GenerateSceneFinalPrompt` |
| Handles | `SaveSceneFinalPrompt` |
| Handles | `RequestSceneImage` |
| Emits | `SceneCreated` |
| Emits | `SceneUpdated` |
| Emits | `SceneDeleted` |
| Emits | `ScenesExtracted` |
| Emits | `SceneFinalPromptSaved` |
| Emits | `SceneImageRequested` |
| Emits | `SceneImageAttached` |

## Linked ADRs

_No linked ADRs._
