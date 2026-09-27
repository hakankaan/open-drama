# AttachEpisodeFilm

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Command · **Context:** [production](index.md)

## Summary

Record the latest rendered film as the episode's video. Issued by the compositing context when a merge completes.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `episodeId` | `ID` | — |
| `filmPath` | `string` | Local media path of the rendered film |
| `durationSeconds` | `number` | — |



## Relationships

| Relationship | Target |
|-------------|--------|
| Actor | `RenderWorker` |
| Handled by | `Episode` |

## Linked ADRs

_No linked ADRs._
