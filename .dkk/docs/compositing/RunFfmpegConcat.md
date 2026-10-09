# RunFfmpegConcat

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [compositing](index.md)

## Summary

When a merge starts, probe every clip, run FFmpeg's concat filter into the merged media directory (each clip fitted into the first clip's frame and frame rate, letterboxed, cut to the length it was generated at when the provider returned a few frames more, with a stereo track trimmed to that length or silence when it has none; re-encoded to H.264/AAC with faststart), probe the film's duration, then complete or fail the merge.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `MergeStarted` |
| Emits | `CompleteMerge` |
| Emits | `FailMerge` |

## Linked ADRs

_No linked ADRs._
