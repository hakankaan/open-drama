# Character

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [assets](index.md)

## Summary

A person in the drama with appearance and styling descriptions, an optional role, a final prompt describing the person, and reference views: a headshot, a full body, optional side and back views, and a multi-view sheet kept from before views or uploaded (adr-0018), and the voice its lines are spoken in: one of the speech model's voices and a recording of its voice, cloned by speech models that clone (adr-0021). Shared across the drama's episodes through episode links, each of which may give it another outfit and a full-body picture of it for that episode (adr-0023).



## Rules & Invariants

- name is required and unique per drama after near-name normalisation; extraction reuses an existing match instead of creating a duplicate.
- Changing appearance or styling keeps finalPrompt but sets finalPromptStale; an explicit finalPrompt in an update always wins and clears the flag.
- The saved final prompt always starts with the drama's style prompt fragment.
- Deletion is a soft delete and removes the character from every episode of the drama.
- Body, side and back views are generated from the headshot as their reference image; a generated headshot of a character without one is drawn from its sheet.
- A voice must be one of the default speech model's voices when there is a speech service. Changing the voice or the voice sample, or deleting the character, clears the line audio of the shots it speaks in; deleting it also removes it as their speaker.
- In an episode where it wears an outfit, its shots send the headshot and the outfit picture as the full body, never the side, back or (while a headshot exists) sheet views, and its prompts describe the outfit instead of the styling. An outfit picture lands only while the outfit is still the one it was drawn for; while it is drawn, the character's views and that picture cannot be changed.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateCharacter` |
| Handles | `UpdateCharacter` |
| Handles | `DeleteCharacter` |
| Handles | `SaveExtractedCharacters` |
| Handles | `GenerateCharacterFinalPrompt` |
| Handles | `SaveCharacterFinalPrompt` |
| Handles | `RequestCharacterImage` |
| Handles | `SetEpisodeOutfit` |
| Handles | `RequestOutfitImage` |
| Emits | `CharacterCreated` |
| Emits | `CharacterUpdated` |
| Emits | `CharacterDeleted` |
| Emits | `CharactersExtracted` |
| Emits | `CharacterFinalPromptSaved` |
| Emits | `CharacterImageRequested` |
| Emits | `CharacterImageAttached` |
| Emits | `EpisodeOutfitSet` |
| Emits | `OutfitImageRequested` |
| Emits | `OutfitImageAttached` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0018](../../adr/adr-0018.md) | Character reference views | accepted |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
