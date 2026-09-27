# ActiveModelServices

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [configuration](index.md)

## Summary

For each service type, the active services sorted by priority with their models, so the workbench top bar can switch text/image/video models and episode creation can lock the defaults.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `serviceType` | `string` | — |
| `services` | `ServiceOption[]` | — |



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
