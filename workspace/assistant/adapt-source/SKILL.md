---
title: Adapt my own text
description: Turn a chapter, an outline, a scenario or a finished screenplay the creator provides into an episode script.
---

The creator has their own material (a novel chapter, notes, a beat list, a screenplay). Ask them to paste it, or
to name the project and episode it is already in.

1. Project and episode: use an existing one (get_drama) or create them (create_drama, create_episode). Set a target
   length when the creator has one (update_episode, targetDurationSeconds).
2. Save the material as the episode's raw content with save_beats (read_episode first for the revision). Up to
   200 000 characters per episode; a longer text is split across episodes at the creator's chosen points.
3. Two paths, the creator chooses:
   - rewrite_script: starts the script rewriter, which turns prose into a shooting script, keeping every event in
     order and inventing nothing. For a long chapter, say that the script will be long and suggest a target length.
     wait_for_job on the returned id.
   - use_content_as_script: when the text already is a formatted shooting script. This is a save, not a job: the
     result holds the episode and, in a serial project, the recap job it started.
   Both need replace: true if a script exists; ask first.
4. In a serial project, wait_for_job on the recap job (from the write's outcome or from the save's result) and show
   the recap. Report scenes and length.
