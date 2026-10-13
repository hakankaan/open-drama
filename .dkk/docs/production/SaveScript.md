# SaveScript

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist the formatted script produced by the script rewriter or the episode writer (their save_script tool), or an assistant's edit of it carrying the revision it read (ifRevision). Replaces the previous formatted script and bumps scriptRevision when the text changed (adr-0016).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `scriptContent` | `string` | — |
| `ifRevision` | `number` | An assistant's save only — the scriptRevision it read; refused when the script changed since |

## Rules & Invariants

- Empty script
- ifRevision is not the current scriptRevision (CONFLICT, naming both revisions)
- The script is being written or read by an agent (an assistant's save follows the creator's rule)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
