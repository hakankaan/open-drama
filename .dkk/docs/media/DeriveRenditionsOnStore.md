# DeriveRenditionsOnStore

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [media](index.md)

## Summary

Whenever an image or video is stored or uploaded, derive its thumbnail or poster frame so list views never load originals.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `MediaStored` |
| Triggered by | `MediaUploaded` |
| Emits | `DeriveRenditions` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | proposed |
