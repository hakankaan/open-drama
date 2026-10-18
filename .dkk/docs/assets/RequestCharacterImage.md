# RequestCharacterImage

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Generate the character's reference views (adr-0018), by default the headshot and the full body. Ensures a final prompt exists first (generating one if missing, falling back to a locally composed prompt when the agent fails), then requests the first view through the generation context using the episode's locked image service unless overridden; each following view is requested when the one before completes, drawn from the headshot. The headshot is 1:1, the other views 9:16. Batch generation in the UI issues this once per asset with bounded concurrency; there is no server-side batch. Without an episode (the project's asset library, adr-0024) the task runs in the explicit service, else the highest-priority active image service, and no episode lock is claimed.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | Optional (adr-0024); with one the task runs in the episode's locked image service, without one in the explicit service, else the highest-priority active one, and no lock is claimed |
| `views` | `string[]` | headshot, body, side and back, each at most once; generated headshot first |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |
| `textModel` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- An image model service is available (locked or active)
- No image model service configured
- An image task for this character is still processing
- A view other than the headshot is requested for a character without a headshot


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | accepted |
| [adr-0018](../../adr/adr-0018.md) | Character reference views | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
