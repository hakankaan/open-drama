# ScriptRewriteJob

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [production](index.md)

## Summary

A running AI rewrite for an episode. Wraps the script_rewriter agent run so the studio can poll it, and records failure explicitly; at most one per episode at a time.



## Rules & Invariants

- Key is the episode; starting while running returns the running job (alreadyRunning) instead of a second run.
- Success is judged by a non-empty scriptContent after the run, not by the model's reply.
- A restart marks a running rewrite as failed.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `RewriteScript` |
| Emits | `ScriptRewriteRequested` |
| Emits | `ScriptRewriteCompleted` |
| Emits | `ScriptRewriteFailed` |

## Linked ADRs

_No linked ADRs._
