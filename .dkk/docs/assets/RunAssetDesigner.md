# RunAssetDesigner

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Policy · **Context:** [assets](index.md)

## Summary

When a design is requested, run the asset designer scoped to the drama with a kind-specific instruction and the run's tool allowlist (the story, the kind's existing assets, the kind's one save) — agents.RunAgent, a cross-context command, see flow AssetDesign. The agent reads the story, reuses existing names and saves the whole set once through the SaveDesigned* command of its kind.





## Relationships

| Relationship | Target |
|-------------|--------|
| Triggered by | `AssetDesignRequested` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
