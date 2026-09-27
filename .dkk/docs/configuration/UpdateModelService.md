# UpdateModelService

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Edit a service (name, base URL, key, models and their order, priority, active flag, temperature). Reordering models so another is first changes the default model; raising priority makes the service the type's active choice.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `serviceId` | `ID` | — |
| `name` | `string` | — |
| `baseUrl` | `string` | — |
| `apiKey` | `string` | — |
| `models` | `string[]` | — |
| `priority` | `number` | — |
| `isActive` | `boolean` | — |
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

_No linked ADRs._
