# Backlog — deferred work

Items the product owner has decided on but pushed out of the current iteration, so they are not forgotten. Each line names the decision that owns it. Move an item into a plan phase when its iteration starts.

## Iteration 2

| Item | Decision | What it involves | Notes |
|---|---|---|---|
| **Live check of the remaining providers** | `adr-0013` | Probe, one text or image call and one 4 s video per provider with the owner's keys: OpenAI and Gemini (text, image), Volcengine Ark China (text, Seedream, Seedance; `图片N` question below), MiniMax H3 `/v2`, Wan on Alibaba Bailian. Verified live on 2026-09-29: BytePlus ModelArk and ModelRunner, end to end | Deferred by the product owner on 2026-09-29 |
| **Native review of the zh/ja/ko UI catalogs** | `adr-0011` | `apps/web/messages/{zh,ja,ko}.json` are machine drafts (2026-09-28). A named native speaker per language reviews terminology (shot, asset, merge, rewrite, provider), counters and tone, then the catalogs count as reviewed | Needed before the first release |

## Later (no iteration assigned)

- Electron desktop shell (utility-process API, same-origin window, data-dir migration, updater) — Plans 1 and 3 "Later".
- In-app update checks for server deployments — Plan 1 "Later".
- SSE/WebSocket push instead of polling — `adr-0008` alternatives, Plan 3 "Later".
- Shot frame images (first/last frame stills) for image-to-video providers — cut from v1, Plan 1 §10.
- Multi-user authentication (`ownerId` on dramas and model services) — Plan 1 §9.
- Orphaned-media cleanup command — `adr-0009` consequences. Also covers uploads whose shot attachment failed afterwards (the upload is immutable and stays behind).
- Video capabilities per model, not only per provider (`videoCapsFor`): Seedance 2.5 (BytePlus, ModelRunner) and MiniMax-H3-Max differ from their families in resolutions, durations and reference counts. Confirm against the providers with live keys, then key the caps table by provider + model so the studio offers only what the model accepts.
- Aggregate reference-duration limits (total seconds of reference video/audio per request) for MiniMax, Seedance 2.x and Wan: probe uploaded media, keep the duration, validate before a task is claimed.
- Seedance mention token: the adapter writes `Name (@ImageN)`. The BytePlus English guides use `@Image 1`, `@Image1` and `[Image 1]` (capital `Image`, counted per asset type); the Volcengine Chinese docs use `图片1` / `@图片1`. Keyed calls on 2026-09-29 accepted it: BytePlus Seedance 2.0 with one reference, and ModelRunner Seedance 2.0 with two (`Flooded greenhouse (@Image1)`, `Pip (@Image2)`), where the clip followed both. Still open: whether Volcengine (or Chinese-language prompts) should render `图片N`.
- ModelRunner beyond the Seedream and Seedance families: its catalog splits each family into mode endpoints with their own input schemas, so each further family needs its field mapping in `adapters/modelrunner.ts` (and per-model caps, above).
- Provider result downloads (`storeRemoteFile`) follow any http(s) URL a provider returns; route them through the guarded fetch in `lib/remote.ts` like reference images.
- Drag-and-drop shot reordering, workbench keyboard shortcuts — Plan 3 "Later".
