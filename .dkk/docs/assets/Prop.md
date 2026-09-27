# Prop

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [assets](index.md)

## Summary

A plot-critical object with a type and a physical description, a final white-background product-shot prompt and a reference image.



## Rules & Invariants

- name is required and deduplicated by near-name normalisation per drama.
- description covers the object's physical appearance only; plot purpose never enters the image prompt.
- Changing the description keeps finalPrompt but sets finalPromptStale; an explicit finalPrompt in an update always wins and clears the flag.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateProp` |
| Handles | `UpdateProp` |
| Handles | `DeleteProp` |
| Handles | `SaveExtractedProps` |
| Handles | `GeneratePropFinalPrompt` |
| Handles | `SavePropFinalPrompt` |
| Handles | `RequestPropImage` |
| Emits | `PropCreated` |
| Emits | `PropUpdated` |
| Emits | `PropDeleted` |
| Emits | `PropsExtracted` |
| Emits | `PropFinalPromptSaved` |
| Emits | `PropImageRequested` |
| Emits | `PropImageAttached` |

## Linked ADRs

_No linked ADRs._
