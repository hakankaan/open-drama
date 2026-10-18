# DeleteScene

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Soft-delete a scene; shots that referenced it lose their scene binding.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `sceneId` | `ID` | — |

## Rules & Invariants

- An image of the scene is being generated (409, delete it once the task has finished)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Scene` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
