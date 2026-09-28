# SaveShots

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [storyboard](index.md)

## Summary

Batch upsert of shots from the agent's save_shots tool (at most 8 per call). The first batch of a breakdown must set replaceExisting, which parks the episode's current shots under the running job id (purged on completion, restored on failure); the batch holding the last shot is marked final; rows are matched by shotNumber; bindings are validated against the drama and auto-linked to the episode; the episode's duration is recomputed.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `replaceExisting` | `boolean` | — |
| `shots` | `ShotInput[]` | shotNumber, title, shotType, angle, movement, location, time, description, result, atmosphere, imagePrompt, videoPrompt, bgmPrompt, soundEffect, durationSeconds, sceneId, characterIds, propIds |

## Rules & Invariants

- A bound scene, character or prop does not belong to the drama


## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `AgentRuntime` |
| Handled by | `Shot` |

## Linked ADRs

_No linked ADRs._
