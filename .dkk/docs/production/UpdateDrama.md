# UpdateDrama

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Update a drama's title, description, genre, style, status, tags, serial flag or outline (the creator's edit from the story tab). The aspect ratio is immutable and is ignored if supplied.


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
| `outline` | `string` | Markdown, at most 20000 characters; empty clears it |

## Rules & Invariants

- Drama not found or deleted
- outline while an outline job is running (the agent's save would replace the edit)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Drama` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
