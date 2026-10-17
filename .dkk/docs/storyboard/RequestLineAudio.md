# RequestLineAudio

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Speak the shot's line in its speaker's voice with the speech service, in the content language. A speech model that clones gets the speaker's voice sample when there is one; otherwise the speaker's named voice is used, which must be one of the model's voices.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `model` | `string` | — |
| `speechServiceId` | `ID` | — |

## Rules & Invariants

- The shot has a line and a speaker who is one of its bound characters
- The speaker has a voice the speech model offers, or a voice sample it can clone
- No speech model service configured
- The line is already being spoken for this shot
- A breakdown of the episode is running
- A speech model that takes no named voice, for a speaker without a sample it can clone


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
