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

## The production floor (image and video services)

Asset extraction (characters, scenes, props from the script), reference images, the storyboard breakdown (shots),
video prompts, shot videos and the episode film. Not driven from the assistant in this iteration; the studio does
them. A changed script makes the recap stale and the storyboard outdated.

## Rules the server enforces

- One agent at a time on a script; an outline is not rewritten while episodes are planned from it; a script in a
  serial is not written while an earlier episode's recap is still being written.
- A saved outline, script or fresh recap is replaced only with `replace: true`; an episode holding a script, shots
  or a film is deleted only with `force: true`; a stale revision is refused with CONFLICT.
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
| studio | the web interface; `studio` in get_status, `studioPath` in results |
