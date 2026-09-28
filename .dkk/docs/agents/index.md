# agents

> Auto-generated — do not edit manually. Run `domain-knowledge-kit render` to regenerate.

The agent runtime and its editable knowledge. Four production agents (script rewriter, extractor, storyboard breaker, prompt generator) run as tool-calling loops against the configured text model; their instructions come from prompt files and skill files in a writable workspace, per content language, and are editable from the settings page.

## Glossary

| Term | Definition | Aliases |
|------|------------|---------|
| **Agent** | A named tool-calling loop with a fixed tool set and instructions assembled per run from its prompt file, its skills and the content-language directive. | — |
| **Agent run** | One invocation of an agent scoped to a drama and episode, with an optional text model or service override, bounded by a maximum number of steps. | — |
| **Prompt file** | The agent's system prompt as Markdown with a small frontmatter (name, optional model override). Language variants sit next to the base file and fall back to it. | — |
| **Skill** | A SKILL.md document (frontmatter name and description plus a body) in a directory under the workspace. Every skill under an agent's prefix is injected in full into its instructions; new skill directories are discovered without restart. | — |
| **Workspace** | The writable directory holding prompts and skills. Shipped as a template and copied once into the data directory on first start, so edits survive upgrades. | — |
| **Language directive** | A highest-priority instruction block telling the agent to write all content in the configured language while never translating existing @mentioned asset names. | — |

## Events

| Event | Description | Raised By | Fields |
|-------|-------------|-----------|--------|
| [AgentPromptReset](AgentPromptReset.md) | A prompt file was deleted and the agent falls back to the next level. | `AgentPrompt` | agentType (string), language (string) |
| [AgentPromptSaved](AgentPromptSaved.md) | A prompt file was written for an agent and language. | `AgentPrompt` | agentType (string), language (string) |
| [AgentRunCompleted](AgentRunCompleted.md) | The loop ended normally; lists the tools called and the final text. Callers verify the expected side effect (script saved, prompt persisted) separately. | `AgentRun` | runId (ID), agentType (string), toolCalls (string[]), steps (number), elapsedSeconds (number) |
| [AgentRunFailed](AgentRunFailed.md) | The run raised an error (provider failure, tool error, step budget exceeded). | `AgentRun` | runId (ID), agentType (string), error (string) |
| [AgentRunStarted](AgentRunStarted.md) | An agent run began with its resolved model and instructions. | `AgentRun` | runId (ID), agentType (string), episodeId (ID), provider (string), model (string) |
| [SkillCreated](SkillCreated.md) | A new skill directory exists and is injected into its agent from the next run. | `AgentSkill` | id (string) |
| [SkillDeleted](SkillDeleted.md) | A skill directory was removed. | `AgentSkill` | id (string) |
| [SkillUpdated](SkillUpdated.md) | A skill's content changed. | `AgentSkill` | id (string), language (string) |

## Commands

| Command | Description | Actor | Handled By | Fields |
|---------|-------------|-------|------------|--------|
| [CreateSkill](CreateSkill.md) | Create a skill directory with a starter SKILL.md under an agent's prefix. | `Creator` | `AgentSkill` | id (string), description (string) |
| [DeleteSkill](DeleteSkill.md) | Remove a skill directory and all its variants; the owning agent stops receiving it. | `Creator` | `AgentSkill` | id (string) |
| [ResetAgentPrompt](ResetAgentPrompt.md) | Delete the prompt file for a language so the agent falls back (variant → base → built-in default). | `Creator` | `AgentPrompt` | agentType (string), language (string) |
| [RunAgent](RunAgent.md) | Run one agent with a user message scoped to an episode and drama. Used by the production, assets and storyboard contexts (rewrite, extraction, breakdown, prompts) and by the debugging chat endpoint. | `AgentRuntime` | `AgentRun` | agentType (string), message (string), episodeId (ID), dramaId (ID), model (string), textServiceId (ID), maxSteps (number) |
| [SaveAgentPrompt](SaveAgentPrompt.md) | Write an agent's prompt file for a language (name, model override for the base language, and the system prompt body). | `Creator` | `AgentPrompt` | agentType (string), language (string), name (string), model (string), systemPrompt (string) |
| [UpdateSkill](UpdateSkill.md) | Overwrite a skill's SKILL.md (or a language variant) with new content. | `Creator` | `AgentSkill` | id (string), language (string), content (string) |

## Policies

_No policies._

## Aggregates

| Aggregate | Description | Handles | Emits |
|-----------|-------------|---------|-------|
| [AgentPrompt](AgentPrompt.md) | The prompt file of one agent in one language. The base language file also carries the optional model override; variants do not. | SaveAgentPrompt, ResetAgentPrompt | AgentPromptSaved, AgentPromptReset |
| [AgentRun](AgentRun.md) | One execution of an agent — resolves instructions and model, runs the tool-calling loop up to the step budget, and reports the tools called and the final text. Success is judged by what the tools persisted, not by the model's reply. | RunAgent | AgentRunStarted, AgentRunCompleted, AgentRunFailed |
| [AgentSkill](AgentSkill.md) | A skill directory with its SKILL.md and optional language variants. Owned by the agent whose prefix its path starts with. | CreateSkill, UpdateSkill, DeleteSkill | SkillCreated, SkillUpdated, SkillDeleted |

## Read Models

| Read Model | Description | Subscribes To | Used By |
|------------|-------------|---------------|---------|
| [AgentCatalog](AgentCatalog.md) | The agent configuration page — every agent with its display name, model override, whether its prompt is the built-in default, and its effective prompt for the selected language (with a flag when the language falls back). | AgentPromptSaved, AgentPromptReset | Creator |
| [SkillCatalog](SkillCatalog.md) | All skills grouped by owning agent with id, name, description (localised when a variant exists) and raw content for editing. | SkillCreated, SkillUpdated, SkillDeleted | Creator |

## Linked ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [adr-0001](../../adr/adr-0001.md) | Product scope and original work | accepted |
| [adr-0002](../../adr/adr-0002.md) | Monorepo with a Next.js web app and a Node.js API | accepted |
| [adr-0003](../../adr/adr-0003.md) | Hono on the Node adapter as the HTTP framework | accepted |
| [adr-0006](../../adr/adr-0006.md) | Agents run on the AI SDK tool loop with file-based prompts and skills | accepted |
| [adr-0007](../../adr/adr-0007.md) | API contract: camelCase JSON validated by shared zod schemas | accepted |
| [adr-0011](../../adr/adr-0011.md) | English is the canonical language for prompts, skills, UI and content | accepted |
| [adr-0012](../../adr/adr-0012.md) | Licence: CC BY-NC-SA 4.0 | accepted |
