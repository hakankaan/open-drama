# Film

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [compositing](index.md)

## Summary

A rendered episode film and the merge job that produced it — which shot clips were included, the encoder settings, status, output path, duration and poster.



## Rules & Invariants

- Clips are concatenated strictly in shot-number order regardless of selection order.
- Every selected shot must have a video file that exists on disk, otherwise the merge is rejected naming the missing shots.
- Output is H.264/AAC MP4 with faststart so it streams in the browser.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `MergeShots` |
| Handles | `CompleteMerge` |
| Handles | `FailMerge` |
| Emits | `MergeStarted` |
| Emits | `FilmRendered` |
| Emits | `MergeFailed` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | accepted |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
