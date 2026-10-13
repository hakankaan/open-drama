---
name: write-episodes
description: "Expand planned episodes into shooting scripts, in order, with a review after each script and each recap."
argument-hint: "<project> [episodes]"
---

Project: $PROJECT. Episodes: $EPISODES.

1. get_drama; resolve the episode range. An episode without beats cannot be written: say so and skip it.
   get_jobs; if a write, rewrite or plan is running, wait for it or stop.
2. For each episode in number order:
   - If it has a script, ask before replacing (write_episode_script needs replace: true).
   - write_episode_script, wait_for_job. On failure, report the error and stop.
   - Report the script in three lines: scenes written, length against the target when there is one, where it ends
     (the hook). Show it when the creator wants to read it (read_episode). Wait for their word. If they want
     changes: edit, save_script with the revision you read; an edited script makes its recap stale, so offer
     write_recap. Only then go on.
   - In a serial project the write's outcome names a recap job; wait_for_job on it, show the recap in two lines
     (read_episode for the text), and wait for the creator's word before the next episode. A recap they want
     changed: edit and save_recap, or write_recap with replace: true after they agreed.
   The creator can ask for the whole range in one go; then report everything at the end instead.
3. When the range is done, offer the "Review the story" skill.


Arguments given: $ARGUMENTS
- project: Project id or title. → use it where $PROJECT appears above; "(not given)" when absent.
- episodes: Which episodes, e.g. "1-3", "4" or "all planned"; defaults to every episode with beats and no script. (optional) → use it where $EPISODES appears above; "(not given)" when absent.
