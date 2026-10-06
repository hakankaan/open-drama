# Drama

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

A short-drama project — the root under which episodes, characters, scenes and props live. Fixes the aspect ratio and the visual style used by every image and video prompt, and whether its episodes continue one story (serial).



## Rules & Invariants

- aspectRatio is chosen at creation and never changes afterwards; every video generated for the drama uses it.
- style must reference an active StylePreset value at creation; the preset's prompt fragment is prepended to every image and video prompt of the drama.
- Deletion is a soft delete; episodes, assets and generation records stay on disk but become unreachable.
- serial defaults to true. When false (an anthology, standalone skits), the agents get the premise but no episode recaps and no recap is written.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateDrama` |
| Handles | `UpdateDrama` |
| Handles | `DeleteDrama` |
| Emits | `DramaCreated` |
| Emits | `DramaUpdated` |
| Emits | `DramaDeleted` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
