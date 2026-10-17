# AttachLineAudio

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Record completed speech as the shot's line audio, grow the shot to hold it after the lead-in (never shrinking it, capped at the longest shot) and mark the video prompt stale. Issued by the generation write-back.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `lineAudioPath` | `string` | — |
| `lineAudioSeconds` | `number` | — |
| `taskId` | `ID` | — |

## Rules & Invariants

- The line, the speaker, or the speaker's voice or sample changed since the request (the audio is kept in the task only)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `GenerationWorker` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
