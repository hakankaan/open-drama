# PlanEpisodes

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Ask the episode planner to split the drama's outline into a given number of new episodes, each with a title, a synopsis and a beat sheet, appended after the existing ones with the chosen resolution, target length and locked services. The request is written to the job's progress at start.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `count` | `number` | How many episodes to add, 1 to 50 |
| `targetDurationSeconds` | `number` | Optional target length applied to every new episode |
| `resolution` | `string` | 480p | 720p | 1080p, default 720p |
| `imageServiceId` | `ID` | Optional image service to lock; else the highest-priority active one |
| `videoServiceId` | `ID` | Optional video service to lock; else the highest-priority active one |
| `model` | `string` | Optional text model override |
| `textServiceId` | `ID` | Optional text service override |

## Rules & Invariants

- An active image and an active video model service exist (the same rule as CreateEpisode)
- The drama has an outline or a synopsis
- No outline job is running for the drama
- If a plan is already running for the drama, the running job is returned (alreadyRunning)
- Drama not found or deleted
- No active image or video service (worded as CreateEpisode)
- Neither outline nor synopsis
- An outline is being written
- No text model service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `EpisodePlanJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
