# TestModelService

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [configuration](index.md)

## Summary

Probe a service's endpoint with a provider-appropriate minimal request (model list, tiny chat completion, or an empty task post) and report reachability, HTTP status and a response preview without creating billable work.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `serviceType` | `string` | — |
| `provider` | `string` | — |
| `baseUrl` | `string` | — |
| `apiKey` | `string` | — |
| `model` | `string` | — |

## Rules & Invariants

- Missing service type, provider or base URL


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `ModelService` |

## Linked ADRs

_No linked ADRs._
