# Character

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [assets](index.md)

## Summary

A person in the drama with appearance and styling descriptions, an optional role, a final turnaround-sheet prompt and a reference image. Shared across the drama's episodes through episode links.



## Rules & Invariants

- name is required and unique per drama after near-name normalisation; extraction reuses an existing match instead of creating a duplicate.
- Changing appearance or styling keeps finalPrompt but sets finalPromptStale; an explicit finalPrompt in an update always wins and clears the flag.
- The saved final prompt always starts with the drama's style prompt fragment.
- Deletion is a soft delete and removes the character from every episode of the drama.


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
| Emits | `CharacterCreated` |
| Emits | `CharacterUpdated` |
| Emits | `CharacterDeleted` |
| Emits | `CharactersExtracted` |
| Emits | `CharacterFinalPromptSaved` |
| Emits | `CharacterImageRequested` |
| Emits | `CharacterImageAttached` |

## Linked ADRs

_No linked ADRs._
