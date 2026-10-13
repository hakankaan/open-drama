---
name: create-story
description: "Take a premise to a project with a story outline and planned episodes, reviewing each step with the creator."
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

## 6. Next
Offer to write the scripts (the "Write the episodes" skill) or to stop here. Give the studio link if there is a studio.


Arguments given: $ARGUMENTS
- premise: The idea in a sentence or a paragraph; may be empty. (optional) → use it where $PREMISE appears above; "(not given)" when absent.
