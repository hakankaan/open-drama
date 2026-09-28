# MediaFile

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [media](index.md)

## Summary

A stored file with its relative path, kind (image, video, audio, film), MIME type, size and derived renditions.



## Rules & Invariants

- File names are uuids with the original extension; a path is never reused, so immutable caching is safe.
- Uploads are validated by extension and MIME (video ≤ 50 MB, audio ≤ 20 MB, images by extension).
- Rendition derivation never blocks or fails the main operation; a missing rendition is tolerated by the UI.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `UploadMedia` |
| Handles | `StoreRemoteFile` |
| Handles | `StoreInlineImage` |
| Handles | `DeriveRenditions` |
| Emits | `MediaUploaded` |
| Emits | `MediaStored` |
| Emits | `RenditionsDerived` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
