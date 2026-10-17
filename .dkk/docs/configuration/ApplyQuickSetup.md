# ApplyQuickSetup

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

From one API key of a compatible gateway, write the recommended services (text, image, video, and on ModelRunner speech, lip sync and vision) with preset base URLs and default models in a single step, then probe each.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `apiKey` | `string` | — |
| `gateway` | `string` | Which recommended template set to apply |

## Rules & Invariants

- Empty API key


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `ModelService` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
| [adr-0022](../../adr/adr-0022.md) | Shot checks by a vision model | proposed |
