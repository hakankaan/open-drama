# StoreRemoteFile

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [media](index.md)

## Summary

Download a provider result URL into the images or videos directory and return the relative path.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `url` | `string` | — |
| `kind` | `string` | image | video |

## Rules & Invariants

- Download failed (HTTP error or timeout)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `MediaFile` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | proposed |
