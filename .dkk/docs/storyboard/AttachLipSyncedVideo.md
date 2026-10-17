# AttachLipSyncedVideo

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Store a completed lip sync with the padded line as its sound and make it the shot's current video. Issued by the generation write-back.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `videoPath` | `string` | — |
| `taskId` | `ID` | — |

## Rules & Invariants

- The shot no longer plays the video the sync was asked for, or its line audio changed (the result only joins the shot's history)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
