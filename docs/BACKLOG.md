# Backlog — deferred work

Items the product owner has decided on but pushed out of the current iteration, so they are not forgotten. Each line names the decision that owns it. Move an item into a plan phase when its iteration starts.

## Iteration 2

| Item | Decision | What it involves | Notes |
|---|---|---|---|
| **BytePlus provider adapter** | `adr-0013` | Adapter(s) for BytePlus ModelArk (ByteDance's international platform) for the Seedance/Seedream families — most likely the Volcengine adapters with BytePlus base URLs; connectivity probe; quick-setup template; `byteplus` shown as "coming soon" in Settings until then | Deferred on 2026-09-27; provider enum value reserved now |
| **ModelRunner provider adapter** | `adr-0013` | One adapter covering images and video through ModelRunner (submit run → poll request → download result), text via its OpenAI-compatible surface if available; probe; quick-setup template | Product owner's own gateway; deferred on 2026-09-27; enum value reserved now |
| **Native review of the zh/ja/ko UI catalogs** | `adr-0011` | `apps/web/messages/{zh,ja,ko}.json` are machine drafts (2026-09-28). A named native speaker per language reviews terminology (shot, asset, merge, rewrite, provider), counters and tone, then the catalogs count as reviewed | Needed before the first release |

## Later (no iteration assigned)

- Electron desktop shell (utility-process API, same-origin window, data-dir migration, updater) — Plans 1 and 3 "Later".
- In-app update checks for server deployments — Plan 1 "Later".
- SSE/WebSocket push instead of polling — `adr-0008` alternatives, Plan 3 "Later".
- Shot frame images (first/last frame stills) for image-to-video providers — cut from v1, Plan 1 §10.
- Multi-user authentication (`ownerId` on dramas and model services) — Plan 1 §9.
- Orphaned-media cleanup command — `adr-0009` consequences. Also covers uploads whose shot attachment failed afterwards (the upload is immutable and stays behind).
- Video capabilities per model, not only per provider (`videoCapsFor`): Seedance 2.5 and MiniMax-H3-Max differ from their families in resolutions, durations and reference counts. Confirm against the providers with live keys, then key the caps table by provider + model so the studio offers only what the model accepts.
- Aggregate reference-duration limits (total seconds of reference video/audio per request) for MiniMax, Seedance 2.x and Wan: probe uploaded media, keep the duration, validate before a task is claimed.
- Seedance mention token: the adapter writes `@ImageN`; official examples also show `@imageN`. Confirm the accepted form with a keyed smoke call.
- Drag-and-drop shot reordering, workbench keyboard shortcuts — Plan 3 "Later".
