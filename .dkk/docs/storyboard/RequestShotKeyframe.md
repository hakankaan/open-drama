# RequestShotKeyframe

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Draw the shot's keyframe: a still of its opening moment in the drama's aspect ratio, made by the episode's locked image service (claimed on first use) from the bound characters' faces (headshot, else the image they have; at most four, the ones the prompts mention first), the scene, the characters' full bodies and the props, in that order, with a legend naming each image the model actually takes. The prompt is the request's, else the shot's keyframe prompt (its image prompt), else one composed from the framing, the first Shot 1 beat of the video prompt (else the description) and the location; the code frames it with the drama's style, a headcount, a wardrobe line, the scene's lighting and identity and clean-frame sentences.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `shotId` | `ID` | — |
| `prompt` | `string` | Keyframe prompt (defaults to the shot's image prompt, else one composed from the shot) |
| `model` | `string` | — |
| `imageServiceId` | `ID` | — |

## Rules & Invariants

- A keyframe prompt, a description or a video prompt
- No image model service configured
- A keyframe for this shot is still generating
- A breakdown of the episode is running
- Characters are bound and the image model takes no reference image (the task fails before anything is paid)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Shot` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0019](../../adr/adr-0019.md) | Shot keyframes and the finishing pass | proposed |
