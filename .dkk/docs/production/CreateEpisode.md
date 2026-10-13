# CreateEpisode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Add the next episode to a drama. Assigns the next episode number, defaults the title, fixes the video resolution and locks the image and video model services that will be used for this episode, for each type that has a usable service; a type without one is locked at its first generation (adr-0016), so the story room needs only a text service.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `title` | `string` | Optional; defaults to "Episode N" |
| `resolution` | `string` | 480p | 720p | 1080p (default 720p) |
| `targetDurationSeconds` | `number` | Optional; how long the episode should run, 10-600 s (SetEpisodeTargetDuration) |
| `imageServiceId` | `ID` | Optional explicit lock; defaults to the highest-priority usable image service, else empty |
| `videoServiceId` | `ID` | Optional explicit lock; defaults to the highest-priority usable video service, else empty |

## Rules & Invariants

- The drama exists and is not deleted
- An explicit imageServiceId or videoServiceId names a usable service of that type
- Drama not found or deleted
- An explicit service id is unknown, inactive, keyless or of the wrong type


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
