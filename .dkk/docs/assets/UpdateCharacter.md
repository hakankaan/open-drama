# UpdateCharacter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Edit a character's fields, manually set its final prompt, or attach an uploaded or generated reference image. Editing appearance or styling marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the stale flag.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `name` | `string` | — |
| `role` | `string` | — |
| `appearance` | `string` | — |
| `styling` | `string` | — |
| `finalPrompt` | `string` | — |
| `imagePath` | `string` | Local media path of an uploaded or generated image |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

_No linked ADRs._
