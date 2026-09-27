# CreateShot

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Manually add a shot to an episode with a number, description, duration and bindings.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `shotNumber` | `number` | — |
| `title` | `string` | — |
| `description` | `string` | — |
| `durationSeconds` | `number` | — |
| `sceneId` | `ID` | — |
| `characterIds` | `ID[]` | — |
| `propIds` | `ID[]` | — |

## Rules & Invariants

- Binding refers to an asset outside the drama


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

_No linked ADRs._
