# StylePreset

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [configuration](index.md)

## Summary

A visual style with a stable key, a display name, an English prompt fragment and a sort order. Dramas reference the key.



## Rules & Invariants

- value is unique, lowercase letters, digits and dashes, and immutable after creation.
- Built-in presets are seeded at startup and upgraded only when their prompt still equals the previous seed text (user edits win).
- Disabled presets are hidden from project creation but keep working for dramas that use them.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateStylePreset` |
| Handles | `UpdateStylePreset` |
| Handles | `DeleteStylePreset` |
| Emits | `StylePresetCreated` |
| Emits | `StylePresetUpdated` |
| Emits | `StylePresetDeleted` |

## Linked ADRs

_No linked ADRs._
