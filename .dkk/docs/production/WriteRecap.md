# WriteRecap

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Ask the recap writer to write the episode's recap from its saved script. Issued by the policy WriteRecapAfterScript after every saved script of a serial drama, and by the creator from the recap card to write or rewrite it; the creator may pick a text model or service for this run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `model` | `string` | Optional text model override |
| `textServiceId` | `ID` | Optional text service override |

## Rules & Invariants

- The drama is serial
- The script is present
- If a recap job is already running for the episode's current script revision, the running job is returned (alreadyRunning)
- Drama not serial
- Empty script
- No text model service configured


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `RecapJob` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
