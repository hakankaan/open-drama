# WriteOutline

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Ask the story writer to write (or rewrite) the drama's story outline from its premise. The agent reads the drama, its current outline as draft notes and the state of every live episode, and persists its result through SaveOutline; the creator may pick a text model or service for this run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `model` | `string` | Optional text model override |
| `textServiceId` | `ID` | Optional text service override |
| `replace` | `boolean` | Rewrite over an existing outline (the studio's button sets it; an assistant must ask first) |

## Rules & Invariants

- The drama has a title (always true) — a synopsis is recommended but not required
- No plan job is running for the drama (the mirror of PlanEpisodes' rule, adr-0016)
- The outline is empty, or replace is set
- If an outline job is already running for the drama, the running job is returned (alreadyRunning)
- Drama not found or deleted
- Episodes are being planned from the outline
- An outline exists and replace is not set
- No text model service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `OutlineJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
