# RequestShotVideo

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Generate a video for the shot. Builds the ordered reference list — the bound scene, then bound characters, then bound props (assets without an image skipped), then any extra images supplied in the request — deduplicated and capped by the provider's limit; rewrites each @[Name] mention in the prompt into the matching reference slot (the adapter renders the provider's token syntax, or plain text when the provider has none); prepends the drama's style prompt; applies the episode resolution and the drama aspect ratio; uses the episode's locked video service unless a service or model override is given. Batch generation and retry-failed issue this once per shot, so a shot whose latest video task is still processing is rejected.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `prompt` | `string` | Video prompt (defaults to the shot's) |
| `model` | `string` | — |
| `videoServiceId` | `ID` | — |
| `durationSeconds` | `number` | — |
| `extraReferenceImageUrls` | `string[]` | Optional extra images appended after the bound assets' reference images |
| `referenceVideoUrls` | `string[]` | — |
| `referenceAudioUrls` | `string[]` | — |
| `generateAudio` | `boolean` | — |

## Rules & Invariants

- At least one reference asset or a non-empty prompt
- Reference counts within the provider's limits
- No video model service configured
- Reference audio without any reference image or video
- Reference material over the provider's limits
- A video task for this shot is still processing


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
