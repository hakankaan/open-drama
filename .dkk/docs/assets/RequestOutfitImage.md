# RequestOutfitImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Draw the character's full body in the episode's outfit (adr-0023): 9:16, from its headshot, in the episode's locked image service (claimed on first use), with a prompt made in code from the full-body framing, the appearance and the outfit, prefixed with the drama's style; no agent runs. The picture lands on the episode link only while the episode is live and the outfit is still the one it was drawn for.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | — |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |

## Rules & Invariants

- The character has an outfit in the episode and a headshot
- An image model service that takes reference images is available (locked or active)
- No outfit in the episode, or no headshot
- An image task for this character is still processing
- No image model service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
