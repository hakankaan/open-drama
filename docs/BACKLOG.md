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
- Purge deleted projects: dramas, episodes and assets are soft-deleted and nothing restores them, but their rows (with their shots, tasks and films) keep their files referenced, so the unused-files cleanup (`adr-0009` amendment) cannot reclaim them. A purge would hard-delete soft-deleted rows, after a confirmation or a retention period, and the cleanup then frees their files.
- Aggregate reference-duration limits (total seconds of reference video/audio per request) for MiniMax, Seedance 2.x and Wan: probe uploaded media, keep the duration, validate before a task is claimed.
- Seedance mention token: the adapter writes `Name (@ImageN)`. The BytePlus English guides use `@Image 1`, `@Image1` and `[Image 1]` (capital `Image`, counted per asset type); the Volcengine Chinese docs use `图片1` / `@图片1`. Keyed calls on 2026-09-29 accepted it: BytePlus Seedance 2.0 with one reference, and ModelRunner Seedance 2.0 with two (`Flooded greenhouse (@Image1)`, `Pip (@Image2)`), where the clip followed both. Still open: whether Volcengine (or Chinese-language prompts) should render `图片N`.
- ModelRunner families not yet run live (`adr-0013` amendment 5): request bodies validate against each endpoint's schema. Seedream, Seedance, Veo 3.1 and Happy Horse 1.1 have run with real keys; Kling, Pixverse, Hailuo, Wan and GPT Image have not, so whether they take references as data URLs is unconfirmed. Also open:
  - Happy Horse wants references at least 400 px on the short side, but references are scaled to fit 768 px, so a very wide reference could fall short;
  - Hailuo takes no shape input, so its clips' shape is not checked;
  - Veo's reference mode takes no length: it renders 8 s (confirmed 2026-10-05) whatever the shot asks for, and the task's recorded `durationSeconds` is the requested length, not the rendered one;
  - Happy Horse's endpoints have no audio flag; its clips come with sound.
- ModelRunner catalog picker lists endpoints the adapter refuses (LongCat needs a start frame): checking a model when it is added in Settings, through the same schema read, would catch it before a shot request does.
- Seedance 2.5 on Ark: the model's `duration: -1` (model picks the length) is not offered.
- Drag-and-drop shot reordering, workbench keyboard shortcuts — Plan 3 "Later".
- Rolling series summary for very long series: the `series` block (`adr-0014`) lists every earlier episode's recap and drops the oldest beyond 40k characters; a maintained whole-series summary would keep the early episodes present at a fixed cost.
- Prompt and skill templates do not upgrade unedited built-ins the way style presets do (content-addressed seed): the series paragraph added to the rewriter and breaker prompt files (`adr-0014`) reaches new installs only; existing workspaces rely on the sentence in the agent message.
- The breakdown has no script snapshot: a manual script edit while a breakdown runs is not detected (the rewrite job is refused, `adr-0014`); keying the breakdown by script revision would catch it.
- Seedance 2.0 on ModelRunner refused its own generated soundtrack once (`OutputAudioSensitiveContentDetected.PolicyViolation`, 2026-10-06, four minutes in): the task failed cleanly, and the same request with `generateAudio: false` completed. The video panel could offer that retry when the error carries this code.
