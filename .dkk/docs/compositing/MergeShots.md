# MergeShots

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [compositing](index.md)

## Summary

Render a film from the episode's shots that have videos (all of them, or the given shot ids). Checks FFmpeg availability and clip existence, creates the merge record and starts rendering in the background. With colour match on, each clip is nudged towards the keyframe it started from, else its shot's keyframe. A clip that continues the clip before it in the film (adr-0020) joins it without a cut and takes its grade; one that continued a version not in the film is matched to its shot's keyframe only; a lip sync counts as the take it was synced from (adr-0021). The film's encoder line records how many clips were matched and joined.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `shotIds` | `ID[]` | Optional subset; still rendered in shot order |
| `colorMatch` | `boolean` | Grade each clip towards its keyframe (default true); clips without one stay as they are |

## Rules & Invariants

- FFmpeg and FFprobe are executable
- At least one selected shot has a video
- No selected shot has a video
- A selected shot's video file is missing on disk
- FFmpeg unavailable


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Film` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0020](../../adr/adr-0020.md) | Continuous takes between shots | proposed |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
