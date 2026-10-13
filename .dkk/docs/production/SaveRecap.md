# SaveRecap

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Persist the recap produced by the recap writer (its save_recap tool), pinned to the script revision its job started from. The creator's own edit of the recap goes through UpdateEpisodeContent and is pinned to the current revision; an assistant's edit comes here with the recapRevision it read (ifRevision) and is pinned the same way. Every save bumps recapRevision (adr-0016).


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `recap` | `string` | — |
| `scriptRevision` | `number` | The revision the recap was written for: the job's start revision for the agent's save; for an assistant's save the scriptRevision it read (forScriptRevision), optional |
| `ifRevision` | `number` | An assistant's save only — the recapRevision it read; refused when the recap changed since |

## Rules & Invariants

- Recap shorter than 20 characters
- Recap longer than 2000 characters
- The script revision has moved on since the job started, or since the assistant read the recap (CONFLICT, naming both revisions)
- Called outside a recap job (no revision to pin to) — the agent's save
- ifRevision is not the current recapRevision (CONFLICT, naming both revisions)
- The recap is being written (an assistant's save)


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
