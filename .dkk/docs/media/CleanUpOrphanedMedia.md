# CleanUpOrphanedMedia

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [media](index.md)

## Summary

Delete the stored files nothing refers to any more (the OrphanedMedia list), after the creator confirms it in the storage settings. The list is worked out again on the server at that moment, never taken from the client.





## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `MediaFile` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0009](../../adr/adr-0009.md) | Local immutable media storage with derived renditions | accepted |
