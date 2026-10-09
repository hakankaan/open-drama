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

## Rules & Invariants

- The drama has a title (always true) — a synopsis is recommended but not required
- If an outline job is already running for the drama, the running job is returned (alreadyRunning)
- Drama not found or deleted
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
