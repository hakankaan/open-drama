# RunFfmpegConcat

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [compositing](index.md)

## Summary

When a merge starts, write the concat list, run FFmpeg (concat demuxer, re-encode to H.264/AAC, faststart) into the merged media directory, probe the duration, then complete or fail the merge.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `MergeStarted` |
| Emits | `CompleteMerge` |
| Emits | `FailMerge` |

## Linked ADRs

_No linked ADRs._
