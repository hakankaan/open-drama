# SeriesContext

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Read Model · **Context:** [production](index.md)

## Summary

What the script rewriter, storyboard breaker and recap writer are told about the rest of the drama, attached as the `series` block of their read tools' results. Always the premise (title, synopsis and genre when set) and the story outline when written, serial or not; for a serial drama also the earlier live episodes in order, each with its recap and whether that recap is ready, stale (the script changed since it was written) or missing, so gaps are named rather than silently absent. Beyond a character budget (60000 characters) the oldest recaps are dropped and listed as omitted; the outline is never cut.


## Fields

| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | — |
| `description` | `string` | The drama's synopsis, when set |
| `genre` | `string` | — |
| `outline` | `string` | The drama's story outline, whole, when non-empty |
| `serial` | `boolean` | — |
| `earlierEpisodes` | `EarlierEpisode[]` | Serial only — episodeNumber, title, status (ready | stale | missing), recap |
| `omittedEpisodes` | `number[]` | Episode numbers whose recaps were dropped for the budget |



## Relationships

| Relationship | Target |
|-------------|--------|
| Subscribes to | `DramaUpdated` |
| Subscribes to | `OutlineSaved` |
| Subscribes to | `ScriptSaved` |
| Subscribes to | `ScriptRewriteSkipped` |
| Subscribes to | `EpisodeContentUpdated` |
| Subscribes to | `RecapSaved` |
| Used by | `AgentRuntime` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0014](../../adr/adr-0014.md) | Series continuity through episode recaps | accepted |
| [adr-0015](../../adr/adr-0015.md) | Story development agents | accepted |
