# BreakdownStoryboard

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Ask the storyboard-breaker agent to split the episode's script into shots with descriptions, atmosphere, durations, bindings and video prompts, replacing the current shots (which are parked until the job succeeds). Runs asynchronously; the UI polls. Returns the running job if one exists.


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
- The script is being rewritten (a running RewriteScript job)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `StoryboardBreakdown` |

## Linked ADRs

_No linked ADRs._
