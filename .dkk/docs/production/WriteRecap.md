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
| `replace` | `boolean` | Rewrite over a fresh recap (one written for the current script revision); the studio's rewrite button sets it, the automatic chain after a saved script never needs it, an assistant must ask first |

## Rules & Invariants

- The drama is serial
- The script is present
- The recap is empty or stale, or replace is set
- If a recap job is already running for the episode's current script revision, the running job is returned (alreadyRunning)
- Drama not serial
- Empty script
- A fresh recap exists and replace is not set
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
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
