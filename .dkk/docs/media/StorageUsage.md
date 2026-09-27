# StorageUsage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [media](index.md)

## Summary

The storage card in settings — data directory paths, deployment mode, disk usage broken down by bucket (database, images, videos, merged, uploads, temp, other), free space and when it was computed (cached with stale-while-revalidate).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `mode` | `string` | — |
| `dataDir` | `string` | — |
| `storageRoot` | `string` | — |
| `databasePath` | `string` | — |
| `usageByBucket` | `BucketUsage[]` | — |
| `freeBytes` | `number` | — |
| `computedAt` | `datetime` | — |
| `stale` | `boolean` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `MediaUploaded` |
| Subscribes to | `MediaStored` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
