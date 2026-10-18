# SaveDesignedScenes

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Bulk save from the asset designer's save_designed_scenes tool (adr-0024), the whole set of places in one call, never empty, every entry with a prompt, capped at 10 (the overflow is named in the reply, not saved). Each entry is matched against the drama by location and time under the extractor's rules; a match gets its empty fields filled and keeps the rest (its final prompt marked stale when a prompt field was filled, its keyframes when the lighting was), a deleted or claimed match is skipped and named, and a new one is created. Nothing is linked to an episode.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `dramaId` | `ID` | — |
| `scenes` | `ExtractedScene[]` | location, time, prompt, lighting |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Scene` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
