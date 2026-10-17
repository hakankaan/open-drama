# ConfigurationReadiness

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [configuration](index.md)

## Summary

Which required service types (text, image, video) still lack an active service; the optional speech, lip-sync and vision types never count. Drives the site-wide banner and the first-run tour.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `missingTypes` | `string[]` | — |
| `ready` | `boolean` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `ModelServiceAdded` |
| Subscribes to | `ModelServiceUpdated` |
| Subscribes to | `ModelServiceDeleted` |
| Subscribes to | `QuickSetupApplied` |
| Used by | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
| [adr-0022](../../adr/adr-0022.md) | Shot checks by a vision model | proposed |
