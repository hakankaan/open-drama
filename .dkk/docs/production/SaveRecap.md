# SaveRecap

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist the recap produced by the recap writer (its save_recap tool), pinned to the script revision its job started from. The creator's own edit of the recap goes through UpdateEpisodeContent and is pinned to the current revision.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `recap` | `string` | — |
| `scriptRevision` | `number` | The revision the recap was written for |

## Rules & Invariants

- Recap shorter than 20 characters
- Recap longer than 2000 characters
- The script revision has moved on since the job started
- Called outside a recap job (no revision to pin to)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
