# WriteRecapAfterScript

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [production](index.md)

## Summary

When a script is saved by the rewriter or the rewrite is skipped, issue WriteRecap for the episode if the drama is serial; a standalone drama gets no recap. A manual script save (UpdateEpisodeContent) marks the existing recap stale and does not re-run the writer: the creator decides from the recap card.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `ScriptSaved` |
| Triggered by | `ScriptRewriteSkipped` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
