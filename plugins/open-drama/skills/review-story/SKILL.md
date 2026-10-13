---
name: review-story
description: "A continuity pass over the outline, the recaps and the scripts; findings only, edits on request."
argument-hint: "<project>"
---

Project: $PROJECT.

1. get_drama for the outline and the episode list; read_episode (recap) for every written episode; read a script
   only when a recap raises a question or the creator names the episode.
2. Look for: a recap that contradicts the outline or an earlier recap; a thread the outline promised that no
   episode advances; a name or a place that drifts; a hook that the next episode does not pick up; a stale or
   missing recap; an episode far from its target length.
3. Report as a short list, each item with the episode number and the fix you propose. No edits yet.
4. On request: outline fixes with save_outline, beat or script fixes with save_beats or save_script (read first,
   pass the revision), a recap rewrite with write_recap (replace: true once the creator agreed). Say when an edit
   makes a recap stale.


Arguments given: $ARGUMENTS
- project: Project id or title. → use it where $PROJECT appears above; "(not given)" when absent.
