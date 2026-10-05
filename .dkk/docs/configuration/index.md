# configuration

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

Configuration of the AI model services the app talks to (text, image and video providers with base URL, key, models and priority), the visual style presets injected into prompts, and application-level settings such as the AI content language.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Model service** | A configured provider endpoint for one service type (text, image or video) with base URL, API key, an ordered list of models (first is the default), a priority and an active flag. Keys live in the database, never in files. | AI service config |
| **Service type** | text, image or video — each stage needs exactly one active service of the type it uses. | — |
| **Provider** | The dialect a service speaks: the official endpoints of the supported model families (openai, gemini, volcengine, minimax, aliyun), plus byteplus (the international Ark, served by the Volcengine adapters) and modelrunner (its own queue adapter, adr-0013). Determines the adapter and the connectivity probe. | — |
| **Quick setup** | Writing a recommended text, image and video service in one step from a single API key of a compatible gateway. | — |
| **Style preset** | A named visual style (3d, anime, ghibli, …) with an English prompt fragment prepended to every image and video prompt of dramas that use it. Built-ins are seeded and upgraded without overwriting user edits. | — |
| **Content language** | The language every agent must write in (scripts, extracted fields, prompts). Changes the prompt and skill variants loaded and appends a highest-priority language directive. | — |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [ContentLanguageChanged](ContentLanguageChanged.md) | The AI content language changed; subsequent agent runs load that language's prompt and skill variants. | `AppSettings` | language (string) |
| [ModelServiceAdded](ModelServiceAdded.md) | A new service exists for a type and may now be the active choice. | `ModelService` | serviceId (ID), serviceType (string), provider (string) |
| [ModelServiceDeleted](ModelServiceDeleted.md) | A service was removed. | `ModelService` | serviceId (ID), serviceType (string) |
| [ModelServiceProbed](ModelServiceProbed.md) | A connectivity probe returned with reachability, status code and a preview. | `ModelService` | provider (string), reachable (boolean), status (number), message (string) |
| [ModelServiceUpdated](ModelServiceUpdated.md) | A service changed; the default model or the active service of its type may have changed with it. | `ModelService` | serviceId (ID), changedFields (string[]) |
| [QuickSetupApplied](QuickSetupApplied.md) | The recommended text, image and video services were written from one key. | `ModelService` | serviceIds (ID[]) |
| [StylePresetCreated](StylePresetCreated.md) | A new style is available for project creation. | `StylePreset` | presetId (ID), value (string) |
| [StylePresetDeleted](StylePresetDeleted.md) | A style was removed. | `StylePreset` | presetId (ID), value (string) |
| [StylePresetUpdated](StylePresetUpdated.md) | A style's prompt or metadata changed; future prompts of dramas using it pick up the new fragment. | `StylePreset` | presetId (ID), changedFields (string[]) |
| [ToursSeenRecorded](ToursSeenRecorded.md) | The set of completed onboarding tours was updated. | `AppSettings` | seen (string[]) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [AddModelService](AddModelService.md) | Add a provider endpoint for a service type with its base URL, API key, models, priority and optional temperature. New services are active by default. | `Creator` | `ModelService` | serviceType (string), provider (string), name (string), baseUrl (string), apiKey (string), models (string[]), priority (number), temperature (number) |
| [ApplyQuickSetup](ApplyQuickSetup.md) | From one API key of a compatible gateway, write the three recommended services (text, image, video) with preset base URLs and default models in a single step, then probe each. | `Creator` | `ModelService` | apiKey (string), gateway (string) |
| [CreateStylePreset](CreateStylePreset.md) | Add a visual style with a unique key, a name, an English prompt fragment, an optional description and sort order. | `Creator` | `StylePreset` | name (string), value (string), prompt (string), description (string), sortOrder (number), isActive (boolean) |
| [DeleteModelService](DeleteModelService.md) | Remove a service permanently. | `Creator` | `ModelService` | serviceId (ID) |
| [DeleteStylePreset](DeleteStylePreset.md) | Hard-delete a style. Dramas keep their key; a deleted built-in may be re-seeded on restart, so disabling is usually preferable. | `Creator` | `StylePreset` | presetId (ID) |
| [RecordToursSeen](RecordToursSeen.md) | Store the ids of onboarding tours the creator has completed so they do not replay. | `Creator` | `AppSettings` | seen (string[]) |
| [SetContentLanguage](SetContentLanguage.md) | Set the language every agent writes in. The UI switches its locale together with it and reloads. | `Creator` | `AppSettings` | language (string) |
| [TestModelService](TestModelService.md) | Probe a service's endpoint with a provider-appropriate minimal request (model list, tiny chat completion, or an empty task post) and report reachability, HTTP status and a response preview without creating billable work. | `Creator` | `ModelService` | serviceType (string), provider (string), baseUrl (string), apiKey (string), model (string) |
| [UpdateModelService](UpdateModelService.md) | Edit a service (name, base URL, key, models and their order, priority, active flag, temperature). Reordering models so another is first changes the default model; raising priority makes the service the type's active choice. | `Creator` | `ModelService` | serviceId (ID), name (string), baseUrl (string), apiKey (string), models (string[]), priority (number), isActive (boolean), temperature (number) |
| [UpdateStylePreset](UpdateStylePreset.md) | Edit a style's name, prompt fragment, description, sort order or active flag. The key cannot change. | `Creator` | `StylePreset` | presetId (ID), name (string), prompt (string), description (string), sortOrder (number), isActive (boolean) |

## Policies

_No policies._

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [AppSettings](AppSettings.md) | Application-wide key-value settings — the AI content language and the list of onboarding tours already seen. Stored in the database so they survive port changes and reinstalls. | SetContentLanguage, RecordToursSeen | ContentLanguageChanged, ToursSeenRecorded |
| [ModelService](ModelService.md) | One configured provider endpoint for a service type. Selected at runtime by explicit id, by an episode's lock, or as the highest-priority active service of its type. | AddModelService, UpdateModelService, DeleteModelService, TestModelService, ApplyQuickSetup | ModelServiceAdded, ModelServiceUpdated, ModelServiceDeleted, ModelServiceProbed, QuickSetupApplied |
| [StylePreset](StylePreset.md) | A visual style with a stable key, a display name, an English prompt fragment and a sort order. Dramas reference the key. | CreateStylePreset, UpdateStylePreset, DeleteStylePreset | StylePresetCreated, StylePresetUpdated, StylePresetDeleted |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [ActiveModelServices](ActiveModelServices.md) | For each service type, the active services sorted by priority with their models, so the workbench top bar can switch text/image/video models and episode creation can lock the defaults. | ModelServiceAdded, ModelServiceUpdated, ModelServiceDeleted, QuickSetupApplied | Creator |
| [AppSettingsView](AppSettingsView.md) | The current content language and the tours already seen, read at app start. | ContentLanguageChanged, ToursSeenRecorded | Creator |
| [ConfigurationReadiness](ConfigurationReadiness.md) | Which service types (text, image, video) still lack an active service. Drives the site-wide banner and the first-run tour. | ModelServiceAdded, ModelServiceUpdated, ModelServiceDeleted, QuickSetupApplied | Creator |
| [ModelCatalog](ModelCatalog.md) | The ModelRunner endpoints a service of one type can use, with their USD prices (per million tokens, per image, or per output second over the resolution tiers). Read live from ModelRunner's public catalog each time the service dialog asks and never stored; image and video list the mode endpoints the adapter offers by category and name (text-to-video and reference-to-video; text-to-image and edit). No per-entry input schema is read here. Picking one adds it to the service's models. | — | Creator |
| [StylePresetCatalog](StylePresetCatalog.md) | Style presets sorted by sort order — active only for project creation, all of them for the settings page. | StylePresetCreated, StylePresetUpdated, StylePresetDeleted | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | accepted |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | accepted |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | accepted |
| [adr-0010](../../adr/adr-0010.md) | Next.js serves the UI as its own process and proxies the API | accepted |
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
| [adr-0013](../../adr/adr-0013.md) | Model providers: official endpoints of supported models, plus BytePlus and ModelRunner | accepted |
