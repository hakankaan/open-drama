# Plan 3 — Frontend (Next.js web app)

Scope: the entire creator-facing UI — the project launcher, settings, the project page and the episode studio — built with Next.js against the API contract of Plan 1. It consumes the read models and commands of the domain model and never talks to a model provider or composes agent prompts itself.

Governing decisions: `adr-0002` (Next.js), `adr-0007` (contract), `adr-0010` (topology), `adr-0011` (English canonical, zh/ja/ko variants). Screens and copy are original work (`adr-0001`).

---

## 1. Goals

1. The complete creator workflow: launcher → settings → project → four-stage studio → export, including batch operations, retries, mention prompts, task drawer, tours and four UI languages.
2. Server state lives in one place (TanStack Query) with polling driven by job/task status; UI preferences persist locally; nothing important is stored only in the browser.
3. Every mutation is awaited and reflected from the server response (no fire-and-forget saves, no stuck "generating" badges, no hidden in-flight regeneration).
4. Same-origin deployment: the browser only talks to the Next.js server, which proxies `/api` and `/static` at request time.
5. A design system of Open Drama's own: tokens, light/dark, one accent, consistent primitives.

## 2. Architecture

**Framework**: Next.js (App Router, TypeScript, `output: 'standalone'`). Pages are thin server components rendering client components; all data fetching is client-side through the API (the app is a tool, not a content site; no SEO).

**Proxy** (`adr-0010`): a request-time proxy file (`proxy.ts`, the App Router request hook) rewrites `/api/:path*` and `/static/:path*` to `process.env.API_ORIGIN` (default `http://localhost:4000`) so the origin is configurable per deployment without a rebuild. `next.config.ts` sets `experimental.proxyTimeout` to 15 minutes because the default 30 s upstream idle timeout would cut off synchronous agent-backed endpoints and stalled media streams. Phase 0 verifies both (a 90 s API response and a paused-then-resumed large video).

**Data layer**: `packages/contracts` schemas → a typed client `lib/api.ts` (`request<T>(schema, method, path, body)` that parses the envelope and throws `ApiError` with `code` and, for tasks, `errorClass`) → one hook file per context under `features/<context>/api.ts` using TanStack Query (`useDramaList`, `useEpisodeShots`, `useStartExtraction`…). Query keys mirror the domain read models; mutations invalidate the affected keys. Polling uses `refetchInterval` returning a number only while a job/task is active (§4.7). Mutations with `alreadyRunning: true` in the response are treated as success and start the same polling.

**UI state**: local component state plus a few persisted preferences via a `usePersistedState(key)` hook (keys prefixed `open-drama:`): theme, locale mirror, sidebar collapsed, workbench column widths, model picks per type, studio panel per episode (restored only on reload), seen tours (mirrored from the server).

**Styling**: Tailwind v4 with the design tokens as CSS custom properties on `:root` and `[data-theme=dark]` (surfaces, text scale, accent, semantic colours, radius, spacing, shadows, z-index). Primitives via Radix (Dialog, DropdownMenu, Select, Switch, Tooltip, Popover) wrapped in `components/ui/*`; icons `lucide-react`; toasts `sonner`; theme `next-themes` (light/dark/system, `data-theme` attribute); onboarding `driver.js`.

**i18n**: `next-intl` with `messages/{en,zh,ja,ko}.json`; `en` is canonical and the fallback. Locale is a cookie + `open-drama:locale`; the header switcher and Settings → General change UI language and the API `contentLanguage` together, with a confirmation dialog whose Cancel really cancels.

**Error handling**: `toastError(err)` maps network / auth / quota / moderation / timeout / provider / unknown to friendly messages using `errorClass` when present, with the moderation hint ("switch the video model and retry") for video failures.

**Media**: `mediaUrl(path)` prefixes `/`; `thumbOf(path)` → `_thumb.webp` with `onError` fallback to the original; `posterOf(path)` → `_poster.jpg`; `<video preload="none" poster>` everywhere in lists.

## 3. Route map and layouts

| Route | Page | Layout |
|---|---|---|
| `/` | Project launcher | `(shell)`: header (brand, Projects/Settings pill nav, GitHub, theme, locale), readiness banner, scrollable content |
| `/settings?tab=ai|general|styles|agents|storage|about` | Settings | `(shell)` |
| `/drama/[id]` | Project page (episodes + asset library) | `(shell)` |
| `/drama/[id]/episode/[episodeNumber]` | Episode studio | `(studio)`: full-viewport, no header |

`episodeNumber` is the drama-relative number; the page resolves it against `GET /dramas/:id`.

## 4. Screens

### 4.1 Shell
- Header with brand (Open Drama wordmark + mark), pill nav with active state, GitHub link, `ThemeToggle` (light → dark → system), `LocaleSwitcher` (menu; opens the unified language dialog).
- **Readiness banner** from `GET /model-services/readiness`: lists missing service types with a "Go to Settings" link; re-fetched on route change and after any model-service mutation.

### 4.2 Launcher `/`
- Head: title/subtitle, stat tags (projects, active, visual styles), help "?" (replays the tour), primary "New project".
- Toolbar: search (client-side over title/style/status), status chips (all / draft "Not started" / active "In progress" / completed), sort (recently updated / name).
- Grid of project cards: cover with initial + aspect-ratio badge, status badge menu (optimistic `PATCH /dramas/:id` with rollback), "…" menu (open / delete), title, style tag, meta counts, relative time. 8 skeletons while loading; two empty states.
- Create dialog: name (required), synopsis (optional, "given to the script and storyboard agents as the series premise"), visual style (searchable select from `GET /style-presets`, hint = description), aspect ratio (16:9 default / 9:16 / 1:1 / adaptive with the "fixed after creation" hint), the switch "Episodes continue one story" (`serial`, on by default; off for anthologies, `adr-0014`). Submit → `POST /dramas` → navigate to the project.
- Delete confirm dialog → `DELETE /dramas/:id`.
- Tour (3 steps: welcome, settings, create) on first visit.

### 4.3 Settings `/settings`
Left nav (220 px) with the six tabs; tab in the URL query so links deep-link.
- **AI services**: provider select lists the official providers plus `byteplus` and `modelrunner` (`adr-0013`), and a preset may set a base URL per service type (ModelRunner serves text and the queue from different hosts); quick-setup card (platform select when there is more than one template, the recommended one first and marked, API key input + "Apply", read-only list of the recommended services from the shared `quick-setup` templates in `packages/contracts`, link to get a key), "manual templates" chips per type, one card per service type with rows (provider badge, name, `hasKey` tag, disabled tag, model chips with default star — click pins as default via `PATCH`, base URL, Test, active switch, edit, delete with confirm). Service dialog: preset pills, name, provider select, priority, key (password, write-only: the edit form shows "key set" and a "replace key" field that is sent only when filled), base URL, models tag editor (Enter adds, paste splits on commas/newlines, click pins first, × removes), for ModelRunner a collapsed "Browse ModelRunner models" panel (loads the live catalog when opened, search box, name, id and USD price per row, Add or Added), temperature (text only), test result box, Test / Cancel / Save.
- **General**: content language (four buttons → unified language dialog), appearance (light/dark/system).
- **Style presets**: list with active count, rows (name, key mono tag, disabled tag, prompt preview, description, switch, edit, delete confirm), dialog (name, key immutable on edit, prompt, description, sort order defaulting to last + 1).
- **Agents**: agent list (four agents with skill counts) + main area with "System prompt" / "Skills (n)" sub-tabs and the editing-language note; prompt pane (file hint, fallback tag, textarea, Reset / Saved / Save); skills pane (expandable cards with textarea, path hint, Save; "Add skill" dialog with directory name, name, description; delete confirm).
- **Storage**: data directory card (mode tag, paths), usage breakdown by bucket with "counting…" while stale (poll `GET /storage` every 2 s until fresh), disk free, notes; an "Unused files" card (`GET /storage/orphans` on open, no polling) whose delete goes through a confirmation.
- **About**: version from `GET /health`, links, the exposure note (no authentication; keep the web port private or put an authenticating proxy in front). Update checks are out of scope.

### 4.4 Project page `/drama/[id]`
- Header card: back, title, style tag, counts, "Edit project" (dialog: title, synopsis, the serial switch → `PATCH /dramas/:id`; style and frame shape stay as created), "Add episode".
- Tabs: **Episodes** (cards with EP number, title, duration, "script ready" / "merged" tags, relative time, status menu, resolution menu 480p/720p/1080p, delete, "Open studio"; trailing "Add episode N" card; add dialog with optional title + resolution + target length and the "locks current services" note; delete confirm) and **Asset library** from `GET /dramas/:id/assets` (segmented filter all/character/scene/prop, grouped cards with image/readiness badge/summary/final-prompt line with a "stale" tag/generate/upload, detail dialog with full field editing, final prompt generate/regenerate + textarea, upload, generate image, save; image viewer).
- Asset generation from the library needs an episode for the prompt agent: when the drama has no episode, the Generate and Generate-prompt buttons are disabled with the tooltip "Create an episode first"; otherwise the first episode's id is used. Readiness comes from the card's latest image task; the library query polls while any card is generating.

### 4.5 Episode studio `/drama/[id]/episode/[n]`
**Top bar**: back, drama title, episode chip, stage label + progress, counts; right: model pickers (text / image / video from `GET /model-services?type=…` active services, composite key `provider/model`, "Default · first model"), resolution picker (tiers and length clamp from `GET /video-models/caps` for the selected video model, falling back to the contract's `videoCapsFor`), locale switcher, help, refresh, "Tasks" button with active-count badge.

**Sidebar** (collapsible, persisted): three sections (Script: raw / AI rewrite; Production: assets / video production; Export: merge & export) with derived state icons, the progress marquee (4 segments, clickable), collapse toggle, refresh.

**Script stage**: step 0 raw content (char count, Save → `PATCH /episodes/:id {content}` awaited, textarea) and step 1 AI rewrite (empty state with Start / Skip and, in a serial drama with earlier episodes, one line counting their ready, stale and missing recaps from `DramaDetail`; running state while the rewrite job is `running` — polled via `/jobs`; a `failed` job shows its error with Retry / Skip; textarea with explicit Save; "Rewrite again"; "Skip rewrite" → `POST /episodes/:id/skip-rewrite`, after which the rail shows Script done because the script was persisted). The user's step is kept across refreshes; only a data change (script appearing) moves it.

**Recap card** (serial dramas, under the script editor, `adr-0014`): the episode's recap as an editable textarea with explicit Save (`PATCH /episodes/:id {recap}`), "Write recap" / "Rewrite recap" → `POST /episodes/:id/recap` with the text-model override; while the recap job runs a spinner replaces the editor, so an edit cannot race the save; a failed job shows its error; a stale recap (`recapStale`, the script changed since) shows a warning. The recap job starts on its own after a rewrite or a skip.

**Production guard**: without a script, the production panel shows "finish the script first" with a link.

**Assets stage**: section bar (ready/total tag; Extract/Re-extract per type, disabled while that target's job runs; batch buttons per type), states (extracting spinner, empty with "Start extraction" running all three, three sections with "+ Add"), cards as on the project page plus hover delete; detail dialog (studio version: only describing fields editable, final prompt generate/regenerate/copy with the "stale — regenerate" hint, upload, generate, save sending only changed fields — an edited prompt is sent as `finalPrompt` and wins); create dialog per kind; delete confirm; upload flow (`POST /media/upload/image` → `PATCH` asset `imagePath`); single generation calls the asset's image endpoint and tracks the returned task; **batch generation is a client loop** over the assets without an image, at most 3 requests in flight, each tracked individually, with a running summary toast. Generating state is always the card's latest image task, never a local flag.

**Video production stage**: section bar (segments · total seconds, aspect ratio tag, Breakdown / Break again — Break again opens a confirm stating that current shots and their generated videos will be replaced (the API parks and restores them on failure) —, Batch fill prompts or "Prompts done/total" while the batch job runs, Retry failed (n), Select mode toggle, Batch videos / Generate selected (n)); empty state with the locked video model banner; the three-column resizable workbench:
1. *Task list* — rows in shot order with poster thumbnail, index, checkbox in select mode, title (description or "Shot #n"), state from `latestVideoTask` (§4.6), duration, scene meta, error text + moderation hint, per-row generate button disabled while generating; metric buttons filter by state; quick-select actions.
2. *Editor* — Shot description (textarea, saved on blur, awaited, rolled back on error), Atmosphere, Reference assets (grouped character → scene → props; scene single-select, others multi; state Usable / Not generated / Unbound; "Go generate →"), Video prompt with `MentionTextarea` and "AI generate / Regenerate" (`POST /shots/:id/video-prompt`, synchronous, running state on the button).
3. *Inspector* — player head (shot number, status, duration, "Set as main video" when previewing history, download), `<video controls>` with poster or the empty/generating state, video history (`GET /shots/:id/videos`; click previews; × deletes the task), bound references strip, sticky footer with duration input (2–30, saved on change) and the effective config line (model · resolution · duration) and the Generate/Regenerate button (disabled while generating).
- **MentionTextarea** grammar: typing `@` opens the picker over the bound assets (characters → scene → props); picking inserts `@[Name] ` (the delimited form supports multi-word names); the backdrop highlights `@[…]` tokens; Backspace after a token removes the whole token; unbound names are highlighted as warnings. The stored prompt keeps the `@[Name]` form; the API resolves it on generation.
- Batch confirm dialog (shots, total seconds, model, resolution) before batch generation and retry; batch calls `POST /shots/:id/video` per target with at most 4 in flight; a `409` (already processing) is shown as "already generating" and not retried.
- Column widths persisted; double-click resets.

**Export stage**: film list (cards with poster/play, failed/merging states, time, duration, download; film preview modal), "Mark done" toggle (`PATCH /episodes/:id {status: completed | active}`), shot assets grid (poster, number, duration, preview modal, selection only for shots with video), "Select all generated" / "Clear", "Merge selected (n)" → `POST /episodes/:id/merge` then poll `GET /episodes/:id/films` (the list the stage shows) every 3 s until no film is processing; a `409` means a merge is already running and the poll starts anyway.

**Task drawer**: right drawer listing `GET /episodes/:id/generation-tasks` (capped: 50 tasks + 20 films) newest first with kind badge, target label (Shot #n / Character · name / Scene · location / Prop · name / Full-episode merge), provider · model, elapsed, error + hint, status pill; refreshes every 4 s while open and anything is active.

**Modals/viewers**: image viewer, shot preview, film preview, asset detail, asset create, delete confirms, batch confirm, break-again confirm. Escape closes the top-most.

### 4.6 State machines (derived, identical to the domain read models)
- **Stage rail**: script done = `scriptContent` present (rewritten or skipped); assets done = total > 0 and all have images; videos done = shots > 0 and all have `videoPath`; export done = episode status `completed`; a section is active when it has progress or is the current panel.
- **Shot video state** (single source: `EpisodeShotList.shots[].latestVideoTask`): `generating` if the latest video task is `processing`; else `failed` if the latest task is `failed` and the shot has no video; else `done` if `videoPath`; else `pending`. A shot being regenerated therefore shows `generating` even though it still has a video, and its Generate button is disabled.
- **Asset readiness** (single source: the card's `latestImageTask` + `imagePath`): `generating` if the latest image task is processing; else `ready` if it has an image; else `failed` if the latest task failed; else `pending`. `finalPromptStale` shows a "regenerate" hint on the prompt line.
- **Narrator exclusion**: characters whose name or role matches narrator terms (en/zh/ja/ko list) are hidden from asset UI, bindings, mentions and counts.

### 4.7 Polling table (TanStack `refetchInterval`)

| Query | Interval | Active while |
|---|---|---|
| `/episodes/:id/jobs` | 2.5 s | any job `running` (rewrite, extraction, breakdown, prompt batch, recap) |
| `/episodes/:id/assets` | 3 s | any asset generating |
| `/episodes/:id/shots` | 4 s | any shot generating |
| `/dramas/:id/assets` (library) | 3 s | any card generating |
| `/episodes/:id/generation-tasks` | 4 s | drawer open and active count > 0 |
| `/episodes/:id/films` | 3 s | a film `processing` |
| `/storage` | 2 s | usage stale |

Per-task polling (`/generation-tasks/:id`) is not used in the studio: the shot list and asset list already carry the latest task state, so a 40-shot batch costs one request per interval, not forty.

## 5. Component and file layout

```
apps/web/
  next.config.ts (standalone, experimental.proxyTimeout)  src/proxy.ts (request-time rewrites)
  tailwind config in CSS  messages/{en,zh,ja,ko}.json
  src/
    app/
      layout.tsx                      # providers: Query, Theme, Intl, Toaster
      (shell)/layout.tsx  page.tsx  settings/page.tsx  drama/[id]/page.tsx
      (studio)/drama/[id]/episode/[episodeNumber]/page.tsx
    lib/ api.ts  errors.ts  media.ts  persisted-state.ts  narrator.ts  time.ts  mentions.ts (grammar helpers)
    components/ui/ button dialog menu select switch tag card textarea input tooltip skeleton confirm-dialog
    components/ app-header.tsx readiness-banner.tsx theme-toggle.tsx locale-switcher.tsx language-dialog.tsx
                model-select.tsx mention-textarea.tsx image-viewer.tsx video-player.tsx tour.ts
    features/
      production/ api.ts  launcher/*  project-page/*  studio/{shell,sidebar,topbar,script-stage}/*
      assets/     api.ts  asset-card.tsx asset-detail-dialog.tsx asset-create-dialog.tsx assets-stage.tsx use-batch-generate.ts
      storyboard/ api.ts  video-stage/{task-list,editor,references,inspector,batch-confirm,break-again-confirm}.tsx
      generation/ api.ts  task-drawer.tsx
      compositing/ api.ts export-stage.tsx film-preview.tsx
      configuration/ api.ts settings/{ai-tab,general-tab,styles-tab,storage-tab,about-tab}.tsx service-dialog.tsx
      agents/     api.ts  settings/agents-tab.tsx skill-editor.tsx
```

## 6. Design direction

- Brand: "Open Drama", a simple clapperboard/aperture mark; accent a single violet-indigo gradient (`#6d5cff → #9d8bff` light; softened in dark) with warm neutrals; semantic colours for success/error/warning/info; pill navigation and rounded cards, with our own tokens.
- Typography: system UI stack + CJK fallbacks; mono for keys/prompts.
- Density: the studio is a dense tool (13 px base in the workbench), the launcher/settings are roomier.
- Motion: subtle fade/lift on cards, marquee highlight on the current stage, no autoplay on hover.
- Every list has loading skeletons and an empty state; every destructive or replacing action has a confirm; every long action shows a running state derived from the server.

## 7. Work breakdown

### Phase 0 — App bootstrap (1 day)
- Next app in the monorepo, `proxy.ts` + `experimental.proxyTimeout`, Tailwind + tokens, providers, `lib/api.ts` + `ApiError`, `messages/en.json`, shell layout with header, readiness banner, theme, locale switcher, `usePersistedState`, `toastError`.
- Done when: the launcher route renders the shell, the banner reflects `GET /model-services/readiness`, toggling theme/locale persists across reloads, a 90 s test response from the API arrives through the proxy, and a large `/static` video plays, pauses for a minute and resumes.

### Phase 1 — Launcher (1 day)
- Cards, toolbar, create/delete dialogs, status menu, skeletons, empty states, tour.
- Done when: create → navigate → delete round-trips against the API.

### Phase 2 — Settings (2 days)
- AI services tab with dialog (write-only key) and test; general; styles; agents (prompts + skills); storage; about.
- Done when: quick setup writes three services and clears the banner; the edit dialog never displays a key; editing a skill and reloading shows the saved text; language switch updates UI and content language and reloads only on confirm.

### Phase 3 — Project page (1 day)
- Episodes tab (cards, menus, add/delete), asset library from `/dramas/:id/assets` (cards, detail dialog, upload, prompt/generate buttons with the no-episode disabled state), viewer.
- Done when: an episode can be created and opened; uploading an image to a character flips its card to ready; with the stub image adapter (Plan 2 Phase E) generating an image shows generating then ready without a reload.

### Phase 4 — Studio shell + script stage (1–2 days)
- Studio layout, top bar with model/resolution pickers and the target-length dialog, sidebar with derived states and marquee, panel persistence, script stage with rewrite job polling (running / failed / done) and skip.
- Done when: pasting text and running the rewrite shows the running state and then the script; skipping persists and the rail shows Script done after a reload; a failed rewrite shows its error with Retry.

### Phase 5 — Assets stage (1–2 days)
- Extraction per type with job polling, cards, detail/create/delete dialogs, upload, single generation and the client-side batch loop, readiness from the assets query.
- Done when: all three extractions run in parallel and the counts update; batch character images (stub adapter) show generating then ready without a reload; editing appearance shows the stale hint and regenerate refreshes the prompt.

### Phase 6 — Video production stage (6–8 days)
- 6a breakdown (with the break-again confirm) + task list with `latestVideoTask` states + filters + select mode; 6b editor (description, atmosphere, references, mention textarea with the `@[Name]` grammar, single prompt generation); 6c inspector (player, history, duration, generate); 6d batch confirm, retry failed, prompt batch progress, resizable columns.
- Done when: a full episode can be broken down, prompts filled, videos generated in batch (stub adapter first, then a real one), failures retried, a regeneration shows generating on a shot that already has a video, and a history clip can be set as main — all states derived from the server.

### Phase 7 — Export stage + task drawer (1 day)
- Film list, selection, merge with polling, preview modals, mark done; task drawer with live counts and caps.
- Done when: merging selected shots produces a playable film in the list and the episode rail shows Export done after marking.

### Phase 8 — Polish (1–2 days)
- zh/ja/ko message catalogs, tours for settings and studio, keyboard handling (Escape stack, Enter/Space on cards), responsive breakpoints (≤ 1080 px stacks the workbench), a11y pass (labels, focus rings, roles), error copy review.
- Done when: every screen works in all four languages and at 1024 px width.

Estimated total: 15–19 working days.

## 8. Verification

- `pnpm typecheck` and `pnpm lint` (eslint + `next lint`) blocking.
- Run against the API with the stub adapters (`OPEN_DRAMA_STUB_PROVIDERS=1`, Plan 2 Phase E) for the full walkthrough; then against real providers for one episode.
- Per-phase manual walkthroughs listed in each "done when", executed in the browser; check the Network panel for the expected calls and no unbounded polling after jobs settle.

## 9. UI rules

- Saves (`content`, `scriptContent`, shot fields) are awaited and reconciled from the response, and rolled back on error.
- Pending state is derived from task status, never kept as a browser-only flag.
- `generating` wins over `done`, so an in-flight regeneration is always visible.
- The script step the user is on survives a refresh unless the data forces a change.
- Skipping the rewrite is persisted by the API, not held in local state.
- Cancel in the language dialog leaves the language unchanged.
- One default duration (10 s), taken from the contract.
- `@[Name]` mentions are resolved by the API, never in the browser.
- Agent messages are owned by the API, never hard-coded in the UI.
- Deleting a model service asks for confirmation.
- Asset batches run as a client-side bounded loop, identical for all three asset kinds.
- Polling is list-level, not one loop per task.

## 10. Later

Desktop bridge (storage migration, updater), SSE for job/task progress instead of polling, drag-and-drop shot reordering, keyboard shortcuts in the workbench, shot image generation (first/last frame) UI if a video adapter needs it.
