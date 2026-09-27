# DramaList

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

The project launcher — every non-deleted drama with its status, aspect ratio, style, counts of episodes, characters and scenes, and last update time. Supports search by title, status filter and sort by updated or title.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `title` | `string` | — |
| `status` | `string` | — |
| `aspectRatio` | `string` | — |
| `style` | `string` | — |
| `episodeCount` | `number` | — |
| `characterCount` | `number` | — |
| `sceneCount` | `number` | — |
| `thumbnail` | `string` | — |
| `updatedAt` | `datetime` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `DramaCreated` |
| Subscribes to | `DramaUpdated` |
| Subscribes to | `DramaDeleted` |
| Subscribes to | `EpisodeCreated` |
| Subscribes to | `EpisodeDeleted` |
| Used by | `Creator` |

## Linked ADRs

_No linked ADRs._
