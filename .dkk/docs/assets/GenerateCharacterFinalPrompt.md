# GenerateCharacterFinalPrompt

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [assets](index.md)

## Summary

Run the prompt-generator agent to write the final prompt for a character, describing the person only: the studio frames it per view (adr-0018). Force regenerates even if one exists. The agent persists through SaveCharacterFinalPrompt; the command waits for the run.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `characterId` | `ID` | — |
| `episodeId` | `ID` | Optional (adr-0024); with one the agent runs in the episode's context, without one in the drama's |
| `force` | `boolean` | — |
| `model` | `string` | — |
| `textServiceId` | `ID` | — |

## Rules & Invariants

- Agent finished without saving a prompt
- The character is claimed while the agent would run (its image, outfit image, description or another prompt in progress, 409); an up-to-date prompt without force is returned as is


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `Creator` |
| Handled by | `Character` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0016](../../adr/adr-0016.md) | Two user interfaces over one service layer | accepted |
| [adr-0018](../../adr/adr-0018.md) | Character reference views | accepted |
| [adr-0024](../../adr/adr-0024.md) | Assets designed from the story | proposed |
