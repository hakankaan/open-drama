# UpdateShot

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Edit any shot field — description, atmosphere, prompts, duration, camera fields, scene binding, character and prop bindings, uploaded reference media, pick a different video from history as the current one, set or remove the keyframe, mark the shot as continuing the previous one in one take, or set its spoken line and who speaks it (adr-0021). A changed line or speaker clears the shot's line audio. A change to what the keyframe is drawn from marks it stale; `keyframeStale: false` keeps the keyframe as it is (adr-0019).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `description` | `string` | — |
| `atmosphere` | `string` | — |
| `videoPrompt` | `string` | — |
| `imagePrompt` | `string` | The keyframe's prompt; empty composes one from the shot |
| `durationSeconds` | `number` | — |
| `sceneId` | `ID` | — |
| `characterIds` | `ID[]` | — |
| `propIds` | `ID[]` | — |
| `referenceMedia` | `ReferenceMedia[]` | Uploaded image / video / audio paths |
| `videoPath` | `string` | Set a historical generation as the current video |
| `keyframePath` | `string` | A stored image as the shot's keyframe, or null to remove it |
| `keyframeStale` | `boolean` | Only false, the keyframe still fits the shot as it is now |
| `continuesPrevious` | `boolean` | One unbroken take with the previous shot; its video starts from that shot's last frame |
| `line` | `string` | The one line spoken in the shot, at most 1000 characters; empty when nobody speaks |
| `speakerId` | `ID` | One of the shot's bound characters, or null for nobody; unbinding the speaker clears it |

## Rules & Invariants

- Binding refers to an asset outside the drama
- durationSeconds outside 2-30
- A keyframe path with no stored file
- A speaker who is not one of the shot's bound characters


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
| [adr-0020](../../adr/adr-0020.md) | Continuous takes between shots | proposed |
| [adr-0021](../../adr/adr-0021.md) | Pinned voices: speech, line audio and lip sync | proposed |
