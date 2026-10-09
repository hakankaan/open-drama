# BreakdownStoryboard

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Ask the storyboard-breaker agent to split the episode's script into shots with descriptions, atmosphere, durations, bindings and video prompts, replacing the current shots (which are parked until the job succeeds). With a target length on the episode, the shots must add up to it. Runs asynchronously; the UI polls. Returns the running job if one exists.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- The episode has a script
- Assets have been extracted (bindings need candidates)
- Episode has no script
- The script is being rewritten or written (a running RewriteScript or WriteEpisodeScript job)
- The episode's target length cannot be met by any storyboard of its video model's shot lengths


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `StoryboardBreakdown` |

## Linked ADRs

_No linked ADRs._
