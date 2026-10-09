# WriteEpisodeScript

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Ask the episode writer to expand a planned episode's beat sheet into a formatted script, given the outline, the earlier episodes' recaps and, in a serial drama, the next episode's beats. The agent persists its result through SaveScript; the creator may pick a text model or service for this run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `model` | `string` | Optional text model override |
| `textServiceId` | `ID` | Optional text service override |

## Rules & Invariants

- Raw content (the beats) is not empty
- No rewrite is running for the episode
- If a write job is already running for the episode, the running job is returned (alreadyRunning)
- Empty raw content
- The script is being rewritten
- No text model service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `EpisodeWriteJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
