# SetEpisodeOutfit

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Set what a character wears in one episode instead of its styling, and the full-body picture of that outfit (adr-0023). A changed outfit drops the picture unless the same request gives one; an empty outfit wears the character's own styling and views and keeps no picture. A changed outfit or picture marks the keyframes of the episode's shots with the character stale (adr-0019).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | — |
| `outfit` | `string` | at most 2000 characters; empty wears the character's styling |
| `outfitPath` | `string` | a stored image, or null to remove the picture |

## Rules & Invariants

- The character is live and linked to a live episode of its drama
- The character, the episode or the link does not exist
- A picture is given without an outfit
- The picture is not a stored file
- A picture is given or removed while one is being drawn


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
