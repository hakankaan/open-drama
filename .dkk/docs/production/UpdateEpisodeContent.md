# UpdateEpisodeContent

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Save the creator's edits to an episode's raw content, formatted script, recap, title or description. A recap is pinned to the current script revision; with scriptContent in the same command the script is written first and the recap pinned to the new revision.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `content` | `string` | Raw source text |
| `scriptContent` | `string` | Formatted script (manual edits) |
| `recap` | `string` | The episode's recap (manual edits), at most 2000 characters |
| `title` | `string` | — |
| `description` | `string` | — |

## Rules & Invariants

- No updatable field supplied
- scriptContent while the script is being rewritten or written (the agent's save would replace the edit)
- content while the script is being rewritten or written (the agent reads it as its source)
- recap while the recap is being written


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
