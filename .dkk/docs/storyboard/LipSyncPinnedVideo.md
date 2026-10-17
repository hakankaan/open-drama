# LipSyncPinnedVideo

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [storyboard](index.md)

## Summary

Under pinned voices, a silent video made for a spoken line is lip-synced as soon as it is attached, to the line audio its length was fitted to. A sync that cannot start (the line changed meanwhile, no lip-sync service) is recorded as a failed lip-sync task so the shot shows why its video has no voice. Nothing is requested once the shot's episode (or its drama) was deleted.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `ShotVideoAttached` |
| Emits | `RequestLipSync` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
