# CharacterImageRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

A reference view generation was requested for a character with a resolved prompt and image service; the views still to come after it travel with the task (adr-0018).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `dramaId` | `ID` | — |
| `view` | `string` | — |
| `prompt` | `string` | — |
| `imageServiceId` | `ID` | — |
| `model` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0018](../../adr/adr-0018.md) | Character reference views | proposed |
