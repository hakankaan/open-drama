# CheckShot

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Have the vision service look over the shot's current video: three frames (at a sixth, half and five sixths of the clip) beside the bound characters' full bodies (else their covers, at most four) and the scene's image, sent as two contact sheets with the expected cast and the shot's description. The model judges four points (more people than the cast or someone twice, an outfit unlike its reference, a setting unlike the scene, visible defects) and writes a note on each in the content language; it never scores whether faces match. A point with nothing to compare with is skipped. The answer comes back in the same request and is stored on the shot with the video it judged.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `model` | `string` | — |
| `visionServiceId` | `ID` | — |

## Rules & Invariants

- The shot has a current video whose file can be read
- No vision service configured
- The shot's episode was deleted
- The shot has no video yet, or its file is missing or unreadable
- The vision model's answer is not the check (nothing is stored)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0022](../../adr/adr-0022.md) | Shot checks by a vision model | proposed |
| [adr-0023](../../adr/adr-0023.md) | Per-episode outfits | proposed |
