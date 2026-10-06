# CreateDrama

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Create a new drama project with a title, an aspect ratio and a visual style. No episodes are pre-created; the creator adds them from the project page.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | — |
| `description` | `string` | Optional synopsis |
| `genre` | `string` | — |
| `style` | `string` | StylePreset value (e.g. 3d, anime) |
| `aspectRatio` | `string` | 16:9 or 9:16, fixed after creation |
| `tags` | `string[]` | — |
| `serial` | `boolean` | Episodes continue one story; default true |

## Rules & Invariants

- style refers to an active StylePreset
- Empty title
- Unknown or disabled style preset


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Drama` |

## Linked ADRs

_No linked ADRs._
