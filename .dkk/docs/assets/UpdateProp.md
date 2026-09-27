# UpdateProp

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Edit a prop's fields, set its final prompt manually, or attach an uploaded or generated image. Editing the description marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the flag.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `propId` | `ID` | — |
| `name` | `string` | — |
| `type` | `string` | — |
| `description` | `string` | — |
| `finalPrompt` | `string` | — |
| `imagePath` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Prop` |

## Linked ADRs

_No linked ADRs._
