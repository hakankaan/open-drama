# ModelService

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [configuration](index.md)

## Summary

One configured provider endpoint for a service type. Selected at runtime by explicit id, by an episode's lock, or as the highest-priority active service of its type.



## Rules & Invariants

- provider must be one the app supports for the service type.
- models is an ordered list; the first entry is the default model for the service.
- temperature, when set, is between 0 and 2 and is sent with every text request.
- Deleting a service is a hard delete; episodes that locked it fall back to the active service of the type.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `AddModelService` |
| Handles | `UpdateModelService` |
| Handles | `DeleteModelService` |
| Handles | `TestModelService` |
| Handles | `ApplyQuickSetup` |
| Emits | `ModelServiceAdded` |
| Emits | `ModelServiceUpdated` |
| Emits | `ModelServiceDeleted` |
| Emits | `ModelServiceProbed` |
| Emits | `QuickSetupApplied` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
