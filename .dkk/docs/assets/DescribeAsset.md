# DescribeAsset

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Run the asset designer on one existing character, scene or prop, in the request (adr-0024), and return the asset as described. Each kind keeps its identity fields (a character's name; a scene's location and time; a prop's name), which the designer never writes, apart from its describable ones (role, appearance, styling, description; prompt, lighting; type, description). Without replace the designer fills the empty describable fields and leaves the filled ones; with replace (adr-0016) it rewrites every describable field, and the final prompt goes stale. The run is offered the story read, the kind's existing-asset read and the kind's one describe tool, so it cannot create assets; it runs from the premise when there is no outline yet. The call takes the asset's claim, shared with its final prompt, its image and its outfit image.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `assetKind` | `string` | character | scene | prop (the route is per kind) |
| `assetId` | `ID` | — |
| `replace` | `boolean` | Rewrite every describable field instead of filling the empty ones |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- Unknown asset (404)
- Every describable field is filled and replace is not set (409, pass replace to write over it)
- The asset is claimed by its image, outfit image, final prompt or another description (409)
- An image task of the asset is processing (409)
- A design run of the asset's kind is running (409)
- Agent finished without describing the asset


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
