# ConfigurationReadiness

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [configuration](index.md)

## Summary

Which service types (text, image, video) still lack an active service. Drives the site-wide banner and the first-run tour.


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

_No linked ADRs._
