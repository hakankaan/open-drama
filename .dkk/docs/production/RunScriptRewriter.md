# RunScriptRewriter

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [production](index.md)

## Summary

When a script rewrite is requested, run the script_rewriter agent scoped to the episode (agents.RunAgent — a cross-context command, see flow ScriptStage). The agent reads the raw content and calls SaveScript; the creator's UI shows a rewriting state until the run completes.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `ScriptRewriteRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
