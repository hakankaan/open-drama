# UpdateDrama

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Update a drama's title, description, genre, style, status, tags or serial flag. The aspect ratio is immutable and is ignored if supplied.


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

## Rules & Invariants

- Drama not found or deleted


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Drama` |

## Linked ADRs

_No linked ADRs._
