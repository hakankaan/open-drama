# AgentSkill

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

**Type:** Aggregate · **Context:** [agents](index.md)

## Summary

A skill directory with its SKILL.md and optional language variants. Owned by the agent whose prefix its path starts with.



## Rules & Invariants

- Skill ids are path segments of lowercase letters, digits and dashes; the frontmatter name equals the last segment.
- All file access is confined to the workspace directory.
- Base-language edits refresh the skill index immediately; variants are read fresh on every run.


## Relationships

| Relationship | Target |
|-------------|--------|
| Handles | `CreateSkill` |
| Handles | `UpdateSkill` |
| Handles | `DeleteSkill` |
| Emits | `SkillCreated` |
| Emits | `SkillUpdated` |
| Emits | `SkillDeleted` |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
