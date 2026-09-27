# assets

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

Characters, scenes and props extracted from an episode's script, deduplicated across the drama, each carrying a final image prompt and a reference image. These reference images are what keep faces, places and objects consistent across generated shots.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Extraction** | An agent run that reads the episode script and upserts characters, scenes or props, deduplicating against what the drama already has and linking the results to the episode. | — |
| **Final prompt** | The complete image prompt for an asset, written by the prompt generator agent from the asset's fields, with the drama's style prompt prepended on save. Editing the describing fields keeps the prompt but marks it stale until it is regenerated or edited by hand. | — |
| **Reference image** | The generated or uploaded image attached to an asset. Bound to shots and passed to the video provider so the asset looks the same in every clip. | — |
| **Episode link** | The many-to-many association saying an asset appears in an episode. Assets belong to the drama; links scope them to episodes. | — |
| **Near-name deduplication** | Characters and props match by exact name or by the name with parenthesised qualifiers and whitespace removed; scenes match by normalised location plus time. | — |
| **Turnaround sheet** | The character's reference image: one sheet that pairs a portrait of the face with the whole figure seen from several fixed angles, drawn to the same scale on a plain backdrop, so later shots can copy the look exactly. | — |
| **Establishing shot** | The scene's reference image: a single wide, steady view of the place with nobody in it, laid out so the depth of the room, where people can enter, and the main furnishings are all readable at once. | — |
| **Product shot** | The prop's reference image: the object by itself in the style of a catalogue photograph, seen whole with true proportions against a neutral backdrop that tells no story. | — |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [CharacterCreated](CharacterCreated.md) | A character was added to the drama (manually or by extraction). | `Character` | characterId (ID), dramaId (ID), name (string) |
| [CharacterDeleted](CharacterDeleted.md) | A character was soft-deleted. | `Character` | characterId (ID) |
| [CharacterFinalPromptSaved](CharacterFinalPromptSaved.md) | A turnaround-sheet final prompt (with style prefix) is stored for the character. | `Character` | characterId (ID) |
| [CharacterImageAttached](CharacterImageAttached.md) | A generated or uploaded image is now the character's reference image; the asset counts as ready. | `Character` | characterId (ID), imagePath (string) |
| [CharacterImageRequested](CharacterImageRequested.md) | A reference image generation was requested for a character with a resolved prompt and image service. | `Character` | characterId (ID), dramaId (ID), prompt (string), imageServiceId (ID), model (string) |
| [CharacterUpdated](CharacterUpdated.md) | The asset's fields changed; if appearance or styling changed, finalPromptStale is now true. | `Character` | characterId (ID), changedFields (string[]), finalPromptStale (boolean) |
| [CharactersExtracted](CharactersExtracted.md) | The extractor agent saved characters for an episode; reports how many were created and how many merged into existing ones. | `Character` | episodeId (ID), created (number), merged (number) |
| [ExtractionCompleted](ExtractionCompleted.md) | The extractor agent run finished for the target type; the linked assets are refreshed in the workbench. | `ExtractionJob` | episodeId (ID), target (string) |
| [ExtractionFailed](ExtractionFailed.md) | The extractor agent run failed or was interrupted by a restart; the error is shown and the creator can retry. | `ExtractionJob` | episodeId (ID), target (string), error (string) |
| [ExtractionStarted](ExtractionStarted.md) | An extraction job for one target type began for the episode. | `ExtractionJob` | episodeId (ID), dramaId (ID), target (string), model (string), textServiceId (ID) |
| [PropCreated](PropCreated.md) | A prop was added to the drama. | `Prop` | propId (ID), dramaId (ID), name (string) |
| [PropDeleted](PropDeleted.md) | A prop was soft-deleted. | `Prop` | propId (ID) |
| [PropFinalPromptSaved](PropFinalPromptSaved.md) | A product-shot final prompt is stored for the prop. | `Prop` | propId (ID) |
| [PropImageAttached](PropImageAttached.md) | An image is now the prop's reference image. | `Prop` | propId (ID), imagePath (string) |
| [PropImageRequested](PropImageRequested.md) | A reference image generation was requested for a prop. | `Prop` | propId (ID), dramaId (ID), prompt (string), imageServiceId (ID), model (string) |
| [PropUpdated](PropUpdated.md) | The asset's fields changed; if the description changed, finalPromptStale is now true. | `Prop` | propId (ID), changedFields (string[]), finalPromptStale (boolean) |
| [PropsExtracted](PropsExtracted.md) | The extractor agent saved props for an episode (possibly none). | `Prop` | episodeId (ID), created (number), merged (number) |
| [SceneCreated](SceneCreated.md) | A scene was added to the drama. | `Scene` | sceneId (ID), dramaId (ID), location (string), time (string) |
| [SceneDeleted](SceneDeleted.md) | A scene was soft-deleted. | `Scene` | sceneId (ID) |
| [SceneFinalPromptSaved](SceneFinalPromptSaved.md) | An establishing-shot final prompt is stored for the scene. | `Scene` | sceneId (ID) |
| [SceneImageAttached](SceneImageAttached.md) | An image is now the scene's reference image; the asset counts as ready. | `Scene` | sceneId (ID), imagePath (string) |
| [SceneImageRequested](SceneImageRequested.md) | A reference image generation was requested for a scene. | `Scene` | sceneId (ID), dramaId (ID), prompt (string), imageServiceId (ID), model (string) |
| [SceneUpdated](SceneUpdated.md) | The asset's fields changed; if description or lighting changed, finalPromptStale is now true. | `Scene` | sceneId (ID), changedFields (string[]), finalPromptStale (boolean) |
| [ScenesExtracted](ScenesExtracted.md) | The extractor agent saved scenes for an episode (created vs reused counts). | `Scene` | episodeId (ID), created (number), reused (number) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [CreateCharacter](CreateCharacter.md) | Manually add a character to a drama, optionally linking it to an episode. | `Creator` | `Character` | dramaId (ID), episodeId (ID), name (string), role (string), appearance (string), styling (string), description (string) |
| [CreateProp](CreateProp.md) | Manually add a prop (name, type, physical description) to a drama, optionally linking it to an episode. | `Creator` | `Prop` | dramaId (ID), episodeId (ID), name (string), type (string), description (string) |
| [CreateScene](CreateScene.md) | Manually add a scene (location, time, description, lighting) to a drama, optionally linking it to an episode. | `Creator` | `Scene` | dramaId (ID), episodeId (ID), location (string), time (string), prompt (string), lighting (string) |
| [DeleteCharacter](DeleteCharacter.md) | Soft-delete a character; it disappears from every episode of the drama and from shot bindings. | `Creator` | `Character` | characterId (ID) |
| [DeleteProp](DeleteProp.md) | Soft-delete a prop; shots that referenced it lose the binding. | `Creator` | `Prop` | propId (ID) |
| [DeleteScene](DeleteScene.md) | Soft-delete a scene; shots that referenced it lose their scene binding. | `Creator` | `Scene` | sceneId (ID) |
| [GenerateCharacterFinalPrompt](GenerateCharacterFinalPrompt.md) | Run the prompt-generator agent to write the turnaround-sheet final prompt for a character (force regenerates even if one exists). The agent persists through SaveCharacterFinalPrompt; the command waits for the run. | `Creator` | `Character` | characterId (ID), episodeId (ID), force (boolean), model (string), textServiceId (ID) |
| [GeneratePropFinalPrompt](GeneratePropFinalPrompt.md) | Run the prompt-generator agent to write the white-background product-shot final prompt for a prop (force regenerates). Persisted through SavePropFinalPrompt. | `Creator` | `Prop` | propId (ID), episodeId (ID), force (boolean), model (string), textServiceId (ID) |
| [GenerateSceneFinalPrompt](GenerateSceneFinalPrompt.md) | Run the prompt-generator agent to write the empty establishing-shot final prompt for a scene (force regenerates). Persisted through SaveSceneFinalPrompt. | `Creator` | `Scene` | sceneId (ID), episodeId (ID), force (boolean), model (string), textServiceId (ID) |
| [RequestCharacterImage](RequestCharacterImage.md) | Generate the character's reference image. Ensures a final prompt exists first (generating one if missing, falling back to a locally composed prompt when the agent fails), then requests a 16:9 image through the generation context using the episode's locked image service unless overridden. Batch generation in the UI issues this once per asset with bounded concurrency; there is no server-side batch. | `Creator` | `Character` | characterId (ID), episodeId (ID), model (string), imageServiceId (ID), textModel (string), textServiceId (ID) |
| [RequestPropImage](RequestPropImage.md) | Generate the prop's reference image as a square white-background product shot. Ensures a final prompt first. | `Creator` | `Prop` | propId (ID), episodeId (ID), model (string), imageServiceId (ID), textModel (string), textServiceId (ID) |
| [RequestSceneImage](RequestSceneImage.md) | Generate the scene's reference image. Ensures a final prompt first; the fallback prompt explicitly excludes people. Readiness is derived from the latest image task, not stored on the scene. | `Creator` | `Scene` | sceneId (ID), episodeId (ID), model (string), imageServiceId (ID), textModel (string), textServiceId (ID) |
| [SaveCharacterFinalPrompt](SaveCharacterFinalPrompt.md) | Persist the final prompt written by the prompt-generator agent, prepending the drama's style prompt fragment. | `AgentRuntime` | `Character` | characterId (ID), prompt (string) |
| [SaveExtractedCharacters](SaveExtractedCharacters.md) | Batch upsert from the extractor agent's save_dedup_characters tool. Each entry is matched against the drama by exact or near name; matches are merged (new non-empty fields win) and new ones created; every entry is linked to the current episode. | `AgentRuntime` | `Character` | episodeId (ID), dramaId (ID), characters (ExtractedCharacter[]) |
| [SaveExtractedProps](SaveExtractedProps.md) | Batch upsert from the extractor agent's save_dedup_props tool (an empty list is valid). Matches by exact or near name; merges keep the id and clear a stale final prompt when the description changed. | `AgentRuntime` | `Prop` | episodeId (ID), dramaId (ID), props (ExtractedProp[]) |
| [SaveExtractedScenes](SaveExtractedScenes.md) | Batch upsert from the extractor agent's save_dedup_scenes tool. Matches by normalised location plus time; matches are reused and enriched, new ones created; all are linked to the episode. | `AgentRuntime` | `Scene` | episodeId (ID), dramaId (ID), scenes (ExtractedScene[]) |
| [SavePropFinalPrompt](SavePropFinalPrompt.md) | Persist the prop final prompt written by the agent with the drama's style prefix prepended. | `AgentRuntime` | `Prop` | propId (ID), prompt (string) |
| [SaveSceneFinalPrompt](SaveSceneFinalPrompt.md) | Persist the scene final prompt written by the agent with the drama's style prefix prepended. | `AgentRuntime` | `Scene` | sceneId (ID), prompt (string) |
| [StartExtraction](StartExtraction.md) | Start an asynchronous extraction of one target type (characters, scenes or props) from the episode's script. Returns immediately; the UI polls the job. Optionally overrides the text model or service for the run. | `Creator` | `ExtractionJob` | episodeId (ID), target (string), model (string), textServiceId (ID) |
| [UpdateCharacter](UpdateCharacter.md) | Edit a character's fields, manually set its final prompt, or attach an uploaded or generated reference image. Editing appearance or styling marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the stale flag. | `Creator` | `Character` | characterId (ID), name (string), role (string), appearance (string), styling (string), finalPrompt (string), imagePath (string) |
| [UpdateProp](UpdateProp.md) | Edit a prop's fields, set its final prompt manually, or attach an uploaded or generated image. Editing the description marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the flag. | `Creator` | `Prop` | propId (ID), name (string), type (string), description (string), finalPrompt (string), imagePath (string) |
| [UpdateScene](UpdateScene.md) | Edit a scene's fields, set its final prompt manually, or attach an uploaded or generated image. Editing the description or lighting marks the final prompt stale (it is kept); a finalPrompt supplied in the same request wins and clears the flag. | `Creator` | `Scene` | sceneId (ID), location (string), time (string), prompt (string), lighting (string), finalPrompt (string), imagePath (string) |

## Policies

| Policy | Description | Triggers | Emits |
|--------|-------------|----------|-------|
| [AttachAssetImageOnGeneration](AttachAssetImageOnGeneration.md) | Triggered by generation.ImageGenerated (a cross-context event, see flow AssetStage) for a task tagged with a character, scene or prop — writes the local image path onto that asset. Failures leave the asset unchanged and are visible on the task. | — | UpdateCharacter, UpdateScene, UpdateProp |
| [RunExtractorAgent](RunExtractorAgent.md) | When an extraction starts, run the extractor agent scoped to the episode with a target-specific instruction (only characters, only scenes, or only plot-critical props) — agents.RunAgent, a cross-context command, see flow AssetStage. The agent reads the script and existing assets, deduplicates and saves through the SaveExtracted* commands. | ExtractionStarted | — |
| [SubmitAssetImageGeneration](SubmitAssetImageGeneration.md) | When an asset image is requested, submit an image generation task tagged with the asset id (generation.SubmitImageGeneration — cross-context, see flow AssetStage). Characters use a 16:9 canvas, props a square canvas, scenes the drama's aspect ratio. | CharacterImageRequested, SceneImageRequested, PropImageRequested | — |

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [Character](Character.md) | A person in the drama with appearance and styling descriptions, an optional role, a final turnaround-sheet prompt and a reference image. Shared across the drama's episodes through episode links. | CreateCharacter, UpdateCharacter, DeleteCharacter, SaveExtractedCharacters, GenerateCharacterFinalPrompt, SaveCharacterFinalPrompt, RequestCharacterImage | CharacterCreated, CharacterUpdated, CharacterDeleted, CharactersExtracted, CharacterFinalPromptSaved, CharacterImageRequested, CharacterImageAttached |
| [ExtractionJob](ExtractionJob.md) | A running extraction for one episode and one target type (characters, scenes or props). Tracks running / done / failed with timestamps so the UI can poll; at most one job per episode and type runs at a time, and the three types may run in parallel. | StartExtraction | ExtractionStarted, ExtractionCompleted, ExtractionFailed |
| [Prop](Prop.md) | A plot-critical object with a type and a physical description, a final white-background product-shot prompt and a reference image. | CreateProp, UpdateProp, DeleteProp, SaveExtractedProps, GeneratePropFinalPrompt, SavePropFinalPrompt, RequestPropImage | PropCreated, PropUpdated, PropDeleted, PropsExtracted, PropFinalPromptSaved, PropImageRequested, PropImageAttached |
| [Scene](Scene.md) | A location at a time period with a set-dressing prompt and lighting, a final establishing-shot prompt and a reference image that contains no people. | CreateScene, UpdateScene, DeleteScene, SaveExtractedScenes, GenerateSceneFinalPrompt, SaveSceneFinalPrompt, RequestSceneImage | SceneCreated, SceneUpdated, SceneDeleted, ScenesExtracted, SceneFinalPromptSaved, SceneImageRequested, SceneImageAttached |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [DramaAssetLibrary](DramaAssetLibrary.md) | The drama-wide asset library tab on the project page — every character, scene and prop of the drama regardless of episode, with image, final prompt and edit/generate affordances. | CharacterCreated, CharacterUpdated, CharacterDeleted, SceneCreated, SceneUpdated, SceneDeleted, PropCreated, PropUpdated, PropDeleted | Creator |
| [EpisodeAssets](EpisodeAssets.md) | The assets stage of the workbench — characters, scenes and props linked to the episode with their fields, final prompt, reference image (plus thumbnail), readiness (ready / generating / pending) and the extraction job status per type. | CharactersExtracted, ScenesExtracted, PropsExtracted, CharacterUpdated, SceneUpdated, PropUpdated, CharacterImageAttached, SceneImageAttached, PropImageAttached, ExtractionStarted, ExtractionCompleted, ExtractionFailed | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | proposed |
| [adr-0004](../../adr/adr-0004.md) | SQLite through Drizzle ORM with migrations applied at startup | proposed |
| [adr-0005](../../adr/adr-0005.md) | One generation task lifecycle behind provider adapters | proposed |
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | proposed |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | proposed |
| [adr-0008](../../adr/adr-0008.md) | Background jobs are in-process and database-backed | proposed |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
