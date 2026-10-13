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
| `replace` | `boolean` | Write over an existing script (the studio's button sets it; an assistant must ask first) |

## Rules & Invariants

- Raw content (the beats) is not empty
- The script is empty, or replace is set
- In a serial drama, no earlier episode's recap job is running (its recap feeds this script, adr-0016)
- No rewrite is running for the episode
- No breakdown or extraction is reading the script
- If a write job is already running for the episode, the running job is returned (alreadyRunning)
- Empty raw content
- A script exists and replace is not set
- An earlier episode's recap is still being written
- The script is being rewritten
- A breakdown or an extraction is reading the script
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
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
