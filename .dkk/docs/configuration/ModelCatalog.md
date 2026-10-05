# ModelCatalog

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [configuration](index.md)

## Summary

The ModelRunner endpoints a service of one type can use, with their USD prices (per million tokens, per image, or per output second over the resolution tiers). Read live from ModelRunner's public catalog each time the service dialog asks and never stored; image and video list the mode endpoints the adapter offers by category and name (text-to-video and reference-to-video; text-to-image and edit). No per-entry input schema is read here. Picking one adds it to the service's models.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | — |
| `name` | `string` | — |
| `description` | `string` | — |
| `price` | `CatalogPrice` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Used by | `Creator` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
