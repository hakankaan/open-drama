# PollUntilSettled

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [generation](index.md)

## Summary

After an asynchronous dispatch, keep polling on the type's cadence until the provider reports completed or failed, or the attempt/duration budget runs out.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `GenerationTaskDispatched` |
| Emits | `PollGenerationTask` |

## Linked ADRs

_No linked ADRs._
