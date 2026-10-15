# UpdateCharacter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Edit a character's fields, manually set its final prompt, or attach or remove an uploaded or generated image per view (adr-0018). Editing appearance or styling marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the stale flag.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `name` | `string` | — |
| `role` | `string` | — |
| `appearance` | `string` | — |
| `styling` | `string` | — |
| `finalPrompt` | `string` | — |
| `views` | `object` | Partial map of view (headshot, body, side, back, sheet) to the local media path of an uploaded or generated image; null removes the view |

## Rules & Invariants

- Views change while an image of the character is generating


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0018](../../adr/adr-0018.md) | Character reference views | proposed |
