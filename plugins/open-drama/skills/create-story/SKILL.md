---
name: create-story
description: "Take a premise to a project with a story outline, planned episodes and a designed cast, reviewing each step with the creator."
argument-hint: "[premise]"
---

Premise from the creator: $PREMISE

## 1. Check readiness
Call get_status. If no text service is ready, run the "Set up Open Drama" skill first.

## 2. The brief
Ask only for what the premise does not give, in one message, with a suggested answer for each:
title; logline (who wants what, what stands in the way); genre and tone; one continuing story or standalone
episodes; how many episodes and how long each (short dramas run 45 to 180 seconds; the planner takes seconds);
aspect ratio and visual style (list_style_presets); language. Confirm the brief in a few lines before creating anything.

## 3. Create the project
create_drama with the title, the logline and tone as the description, genre, tags, style, aspect ratio and
serial. Keep the returned id and studioPath.

## 4. The outline
write_outline, then wait_for_job. Read the outline from get_drama and present it in the creator's terms:
logline, cast (one line each), the acts, the ending, the season shape the writer suggests; show the full text when
they want to read it. Ask what to change. Small changes: edit the text yourself and save_outline with the
revision you read. Large ones: write_outline with replace: true after the creator agreed, after putting the new
direction into the description with update_drama. Stop here until the creator is happy with the outline.

What a good outline has for a short drama: few places, a cast that can be cast, one turn per episode, an ending
that is decided, a season shape that fits the number of turns.

## 5. Plan the episodes
plan_episodes with the count and the episode length from the brief (the outline's season shape may suggest other
numbers; say so and let the creator choose). wait_for_job; its outcome lists the episodes added. Present them:
number, title, synopsis. A beat sheet the creator wants changed: read_episode (beats), edit, save_beats. An
episode they do not want: delete_episode after they confirm.

## 6. Design the cast, places and props
Offer to design the project's assets from the outline: the characters it names, the places of its world and the
few props its threads turn on. Each kind is one agent run, billed like the outline; existing assets keep what they
have. When the creator agrees: design_assets for characters, scenes and props (they run side by side), then
wait_for_job on each. The outcome counts what was saved and filled and names what was skipped or did not fit; say
so when a name is missing. Present them from list_assets: each character's name, role and look in one line, each
place with its time of day, each prop. Changes the creator words: update_asset, after reading the asset. One to
redo: describe_asset with replace: true after they agreed. One they add: create_asset with a name (a character
or a prop) or a location and time of day (a scene), then describe_asset. One they do not want: delete_asset with
confirm: true after they agreed.

The pictures are drawn in the studio, not here, and cost image credits: send the creator to the project's Assets
tab (the studio address with the studioPath of list_assets), where each asset gets its image prompt and its
reference images, before any episode is written. write_final_prompt shows an image prompt here first when they want
to read it. Without a studio, say the images wait until one runs.

## 7. Next
Offer to write the scripts (the "Write the episodes" skill) or to stop here. Give the studio link if there is a studio.


Arguments given: $ARGUMENTS
- premise: The idea in a sentence or a paragraph; may be empty. (optional) → use it where $PREMISE appears above; "(not given)" when absent.
