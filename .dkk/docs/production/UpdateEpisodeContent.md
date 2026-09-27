# UpdateEpisodeContent

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Save the creator's edits to an episode's raw content, formatted script, title or description. Used by the script workbench autosave.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `content` | `string` | Raw source text |
| `scriptContent` | `string` | Formatted script (manual edits) |
| `title` | `string` | — |
| `description` | `string` | — |

## Rules & Invariants

- No updatable field supplied


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
