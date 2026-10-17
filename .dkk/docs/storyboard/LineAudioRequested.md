# LineAudioRequested

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [storyboard](index.md)

## Summary

A shot's line was sent to the speech service in its speaker's voice (named, or cloned from a sample).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `speakerId` | `ID` | — |
| `voice` | `string` | — |
| `cloned` | `boolean` | — |
| `language` | `string` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
