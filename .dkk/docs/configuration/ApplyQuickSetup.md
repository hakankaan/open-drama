# ApplyQuickSetup

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

From one API key of a compatible gateway, write the three recommended services (text, image, video) with preset base URLs and default models in a single step, then probe each.


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

_No linked ADRs._
