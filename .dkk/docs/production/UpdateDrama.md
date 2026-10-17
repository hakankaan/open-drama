# UpdateDrama

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Update a drama's title, description, genre, style, status, tags, serial flag, series look or outline (the creator's edit from the story tab), or whether its voices are pinned. The aspect ratio is immutable and is ignored if supplied.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `title` | `string` | — |
| `description` | `string` | — |
| `genre` | `string` | — |
| `style` | `string` | — |
| `status` | `string` | draft | active | completed (project-level status shown on the launcher) |
| `tags` | `string[]` | — |
| `serial` | `boolean` | — |
| `look` | `string` | none | warm | cool | teal_orange | faded | mono — the grade laid over every merged film of the drama |
| `outline` | `string` | Markdown, at most 20000 characters; empty clears it; every change bumps outlineRevision (adr-0016) |
| `pinnedVoices` | `boolean` | Spoken lines are read by the speech service and shot videos are made silent and lip-synced (adr-0021) |

## Rules & Invariants

- Drama not found or deleted
- outline while an outline job is running (the agent's save would replace the edit)
- outline while a plan job is running (the planner reads the outline batch by batch)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Drama` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
