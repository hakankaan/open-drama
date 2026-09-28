# SetContentLanguage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Set the language every agent writes in. The UI switches its locale together with it and reloads.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `language` | `string` | zh | en | ja | ko |

## Rules & Invariants

- Unsupported language


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `AppSettings` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
