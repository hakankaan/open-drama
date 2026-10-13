# SaveOutline

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist the outline produced by the story writer (its save_outline tool), or an assistant's edit of it carrying the revision it read (ifRevision); either bumps outlineRevision (adr-0016). The creator's own edit from the story tab goes through UpdateDrama.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `outline` | `string` | Markdown, 200 to 20000 characters (an assistant may save at most 20000 characters of any length above 0) |
| `ifRevision` | `number` | An assistant's save only — the outlineRevision it read; refused when the outline changed since |

## Rules & Invariants

- Outline shorter than 200 characters
- Outline longer than 20000 characters
- Called outside an outline job (the agent's save)
- ifRevision is not the current outlineRevision (CONFLICT, naming both revisions)
- An outline job is running (an assistant's save)
- A plan job is running (an assistant's save; the planner reads the outline batch by batch)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Drama` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
