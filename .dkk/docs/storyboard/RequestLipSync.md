# RequestLipSync

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Re-sync the shot's video to its line audio with the lip-sync service. The source is the shot's current video, or, when that is itself a lip sync, the video it was made from; the audio is the line after a half-second lead-in, padded with silence to the video's length. Issued by the creator, or by LipSyncPinnedVideo.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `model` | `string` | — |
| `lipsyncServiceId` | `ID` | — |

## Rules & Invariants

- The shot has a spoken line with its line audio, and a video
- The line after its lead-in fits in the video
- No lip-sync model service configured
- A video or a lip sync for this shot is still generating
- The video or the line audio cannot reach a remote provider (no public URL, no fresh provider URL, too large to inline)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
