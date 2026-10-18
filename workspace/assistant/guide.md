# How Open Drama works

Open Drama turns a story into a short drama in stages. Each stage reads the one before it and is reviewed before
the next; the creator may do any of them in the web studio or through you.

## The story room (text only)

- **Project** (a *drama* in the tools): title, description (logline and tone), genre, tags, visual style, aspect
  ratio, and *serial*: true when the episodes continue one story and get recaps, false for standalone episodes.
- **Outline**: the project's story in Markdown (logline, cast, acts, ending, season shape). Written by the story
  writer (write_outline) or saved by hand (save_outline). Carries `outlineRevision`.
- **Episodes**: number, title, synopsis, *beats* (the raw content: a beat sheet from the planner, or the creator's
  own prose, notes or screenplay), *script* (the formatted shooting script), *recap* (what happened, for the writers
  of later episodes; serial projects only). Each text carries a revision; a save passes the revision read.
- **Agent runs** are server jobs that bill the configured text service: write_outline, plan_episodes (append-only),
  write_episode_script (beats → script), rewrite_script (prose → script, inventing nothing), write_recap.
  use_content_as_script is a save, not a run. A write in a serial project starts the recap job itself and names it
  in its outcome.

## Assets (text only)

- **Characters, scenes and props** belong to the project and are shared by its episodes. A character has a role, an
  appearance (body, face, hair; no clothes), a styling (what they usually wear) and a description; a scene is a
  location at a time of day with its set dressing (`prompt`) and lighting; a prop has a type and a description of the
  object itself. Each carries a *final prompt*, the image prompt written from those fields, and reference images.
- design_assets designs one kind for the whole project from the outline, one agent run per kind, the three side by
  side: the cast the outline names, the places of its world, the props its threads turn on. Existing assets keep
  their fields; only empty ones are filled. describe_asset does the same for one asset.
- create_asset, update_asset and delete_asset are the creator's own edits; list_assets reads the library, or one
  episode's assets with what each character wears there.
- extract_assets, once an episode has a script, links the assets the script uses by their names, adds the ones it
  introduces and dresses a character the episode shows in other clothes.
- write_final_prompt writes an asset's image prompt; nothing is drawn.
- **Images are drawn in the studio.** The project's asset library (the Assets tab) draws each asset's reference images,
  before any episode exists. Drawing them from the assistant, and an episode's outfit picture, waits for a
  paid-generation setting that does not exist yet; without a studio the images wait.

## The production floor (image and video services)

Reference images, the storyboard breakdown (shots), video prompts, shot videos and the episode film. Not driven from
the assistant in this iteration; the studio does them. A changed script makes the recap stale and the storyboard
outdated.

## Rules the server enforces

- One agent at a time on a script; an outline is not rewritten while episodes are planned from it; a script in a
  serial is not written while an earlier episode's recap is still being written.
- A saved outline, script or fresh recap is replaced only with `replace: true`; an episode holding a script, shots
  or a film is deleted only with `force: true`; a stale revision is refused with CONFLICT.
- `describe_asset` rewrites an asset's filled describing fields, and `write_final_prompt` an up-to-date image
  prompt, only with `replace: true`; `update_asset` has no flag and writes the creator's own words over the fields
  it names. An asset is deleted only with `confirm: true`, and not while one of its images is being drawn. Assets
  carry no revision: the last write wins, so read before you edit; an edit, a description or a prompt is refused
  with CONFLICT while an image, a prompt or a description of the asset is in progress.
- Image and video services are locked to an episode at its first generation, so later changes in the settings do
  not alter an episode half-way through.
- Jobs survive a restart as failed rows; `wait_for_job` reports the outcome of a settled one.

## Vocabulary

| In conversation | In the tools |
| --- | --- |
| project | drama, dramaId |
| raw content, beat sheet, source text | beats (`content`) |
| shooting script | script (`scriptContent`) |
| episode length | `targetDurationSeconds` |
| cast, places, props | characters, scenes, props (assets) |
| image prompt | `finalPrompt` |
| studio | the web interface; `studio` in get_status, `studioPath` in results |
