# ContentLanguageChanged

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [configuration](index.md)

## Summary

The AI content language changed; subsequent agent runs load that language's prompt and skill variants.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `language` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `AppSettings` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
