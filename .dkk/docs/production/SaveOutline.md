# SaveOutline

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist the outline produced by the story writer (its save_outline tool). The creator's own edit of the outline goes through UpdateDrama.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `outline` | `string` | Markdown, 200 to 20000 characters |

## Rules & Invariants

- Outline shorter than 200 characters
- Outline longer than 20000 characters
- Called outside an outline job


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Drama` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
