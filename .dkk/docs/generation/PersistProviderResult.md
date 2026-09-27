# PersistProviderResult

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [generation](index.md)

## Summary

When a provider result arrives, store it in local media (media.StoreRemoteFile for a URL, media.StoreInlineImage for base64 — cross-context, see flow GenerationTaskLifecycle), let media derive renditions, then complete the task with the local path so nothing downstream depends on an expiring provider URL.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `ProviderResultReceived` |
| Emits | `CompleteGenerationTask` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | proposed |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | proposed |
