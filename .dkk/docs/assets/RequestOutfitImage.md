# RequestOutfitImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Draw the character's full body in the episode's outfit (adr-0023): 9:16, from its headshot, in the episode's locked image service (claimed on first use), with a prompt made in code from the full-body framing, the appearance and the outfit, prefixed with the drama's style; no agent runs. The picture lands on the episode link only while the episode is live and the outfit is still the one it was drawn for. The character is claimed while the request is prepared and submitted, so a bulk save leaves its fields and the outfit alone meanwhile (adr-0024).


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
- The character is claimed by another request (its image, prompt or outfit picture being prepared)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
