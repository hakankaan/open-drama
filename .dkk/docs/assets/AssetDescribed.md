# AssetDescribed

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Event · **Context:** [assets](index.md)

## Summary

The asset designer described one existing character, scene or prop from the story (adr-0024): the describable fields it wrote and the ones it kept. When a field the final prompt is written from changed, the prompt is stale; a character's styling and a scene's lighting also stale the keyframes bound to it.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `assetKind` | `string` | — |
| `assetId` | `ID` | — |
| `written` | `string[]` | — |
| `kept` | `string[]` | — |
| `replace` | `boolean` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Raised by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
