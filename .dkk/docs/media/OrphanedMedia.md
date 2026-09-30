# OrphanedMedia

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [media](index.md)

## Summary

Stored files that no row in the database mentions any more, with their count and size per bucket: an asset image that was replaced, a take whose generation task was deleted, an upload that was never attached. Only files the store wrote (uuid names and their renditions) in the uploads, images, videos and merged buckets count, and only once they are older than the grace period; temp is never included.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `files` | `number` | — |
| `bytes` | `number` | — |
| `byBucket` | `BucketUsage[]` | — |
| `graceHours` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `MediaUploaded` |
| Subscribes to | `MediaStored` |
| Subscribes to | `OrphanedMediaRemoved` |
| Used by | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
