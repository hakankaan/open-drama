# DeleteCharacter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Soft-delete a character; it disappears from every episode of the drama and from shot bindings.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |

## Rules & Invariants

- An image of the character is being generated (409, delete it once the task has finished)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
