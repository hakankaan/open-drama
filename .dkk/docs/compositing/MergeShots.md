# MergeShots

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [compositing](index.md)

## Summary

Render a film from the episode's shots that have videos (all of them, or the given shot ids). Checks FFmpeg availability and clip existence, creates the merge record and starts rendering in the background.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `shotIds` | `ID[]` | Optional subset; still rendered in shot order |

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

_No linked ADRs._
