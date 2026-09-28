# AppSettings

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [configuration](index.md)

## Summary

Application-wide key-value settings — the AI content language and the list of onboarding tours already seen. Stored in the database so they survive port changes and reinstalls.



## Rules & Invariants

- contentLanguage is one of the supported languages; an unset or invalid value reads as the default language.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `SetContentLanguage` |
| Handles | `RecordToursSeen` |
| Emits | `ContentLanguageChanged` |
| Emits | `ToursSeenRecorded` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
