# CreateEpisode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Add the next episode to a drama. Assigns the next episode number, defaults the title, fixes the video resolution and locks the image and video model services that will be used for this episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `title` | `string` | Optional; defaults to "Episode N" |
| `resolution` | `string` | 480p | 720p | 1080p (default 720p) |
| `imageServiceId` | `ID` | Optional explicit lock; defaults to the active image service |
| `videoServiceId` | `ID` | Optional explicit lock; defaults to the active video service |

## Rules & Invariants

- The drama exists and is not deleted
- An active image model service and an active video model service exist
- No active image service configured
- No active video service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
