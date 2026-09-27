# UpdateShot

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Edit any shot field — description, atmosphere, prompts, duration, camera fields, scene binding, character and prop bindings, uploaded reference media, or pick a different video from history as the current one.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `description` | `string` | — |
| `atmosphere` | `string` | — |
| `videoPrompt` | `string` | — |
| `imagePrompt` | `string` | — |
| `durationSeconds` | `number` | — |
| `sceneId` | `ID` | — |
| `characterIds` | `ID[]` | — |
| `propIds` | `ID[]` | — |
| `referenceMedia` | `ReferenceMedia[]` | Uploaded image / video / audio paths |
| `videoPath` | `string` | Set a historical generation as the current video |

## Rules & Invariants

- Binding refers to an asset outside the drama
- durationSeconds outside 2-30


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

_No linked ADRs._
