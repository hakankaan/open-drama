# UpdateScene

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Edit a scene's fields, set its final prompt manually, or attach an uploaded or generated image. Editing the description or lighting marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the flag.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `sceneId` | `ID` | — |
| `location` | `string` | — |
| `time` | `string` | — |
| `prompt` | `string` | — |
| `lighting` | `string` | — |
| `finalPrompt` | `string` | — |
| `imagePath` | `string` | — |

## Rules & Invariants

- An image, a prompt or a description of the scene is in progress (409)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Scene` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
