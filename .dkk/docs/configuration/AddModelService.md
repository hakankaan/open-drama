# AddModelService

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Add a provider endpoint for a service type with its base URL, API key, models, priority and optional temperature. New services are active by default.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `serviceType` | `string` | text | image | video |
| `provider` | `string` | — |
| `name` | `string` | — |
| `baseUrl` | `string` | — |
| `apiKey` | `string` | — |
| `models` | `string[]` | — |
| `priority` | `number` | — |
| `temperature` | `number` | — |

## Rules & Invariants

- Unsupported provider for the service type
- Temperature outside 0-2


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `ModelService` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
