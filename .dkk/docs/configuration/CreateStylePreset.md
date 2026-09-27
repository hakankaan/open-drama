# CreateStylePreset

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Add a visual style with a unique key, a name, an English prompt fragment, an optional description and sort order.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | — |
| `value` | `string` | — |
| `prompt` | `string` | — |
| `description` | `string` | — |
| `sortOrder` | `number` | — |
| `isActive` | `boolean` | — |

## Rules & Invariants

- Missing name, key or prompt
- Key not lowercase letters, digits and dashes
- Key already exists


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `StylePreset` |

## Linked ADRs

_No linked ADRs._
