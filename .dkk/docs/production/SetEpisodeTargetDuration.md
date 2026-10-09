# SetEpisodeTargetDuration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Set how long the episode should run on screen, in whole seconds, or clear it so the storyboard follows the script. The script rewrite and the storyboard breakdown fit the episode to it; the current script and shots are left as they are until they are rewritten or broken down again.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `targetDurationSeconds` | `number` | 10-600, or null to clear |

## Rules & Invariants

- targetDurationSeconds is not a whole number from 10 to 600


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
