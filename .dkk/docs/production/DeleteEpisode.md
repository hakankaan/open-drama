# DeleteEpisode

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Soft-delete an episode. Its shots and generation records are kept but no longer reachable; later episodes keep their numbers. Refused while a job of the episode runs, and, unless forced, when the episode holds a script, shots or a film, naming what would be lost (adr-0016); the studio's confirmation dialog forces.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `force` | `boolean` | Delete even though the episode holds a script, shots or a film |

## Rules & Invariants

- No job of the episode is running
- force is set, or the episode holds no script, no shots and no film
- Episode not found
- A job of the episode is still running
- The episode holds a script, shots or a film and force is not set


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Episode` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
