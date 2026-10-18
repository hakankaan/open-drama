# DeleteProp

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Soft-delete a prop; shots that referenced it lose the binding.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `propId` | `ID` | — |

## Rules & Invariants

- An image of the prop is being generated (409, delete it once the task has finished)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Prop` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
