import type { AgentType } from '@open-drama/contracts';
import type { AgentRunScope } from '../runtime/context';

export interface AgentDefinition {
  type: AgentType;
  name: string;
  /**
   * A drama-scoped agent runs without an episode and carries drama tools only (adr-0015). An agent of either scope
   * runs in the episode's context when one is given and in the drama's otherwise, where only its drama tools are
   * offered (adr-0024).
   */
  scope: AgentRunScope;
  /** Prompt file base name under prompts/. */
  promptFile: string;
  /** Every skill whose id starts with one of these is injected into the instructions. */
  skillPrefixes: string[];
  maxSteps: number;
  /**
   * The agent writes something new (a story, a script, a design, shots, a prompt), so its runs ask the model to think
   * first; an agent that only restates what it reads (extraction, recaps) runs with thinking off.
   */
  thinking: boolean;
  /** Its save tool works only inside its job (the job row holds its state), so the chat route refuses it. */
  jobOnly?: boolean;
  /** Built-in fallback when the workspace has no prompt file. */
  defaultPrompt: string;
}

export const AGENTS: Record<AgentType, AgentDefinition> = {
  script_rewriter: {
    type: 'script_rewriter',
    scope: 'episode',
    name: 'Script rewriter',
    promptFile: 'script_rewriter',
    skillPrefixes: ['script-rewriter'],
    thinking: true,
    maxSteps: 20,
    defaultPrompt:
      'Rewrite the episode raw content into a formatted shooting script: scene headings, action paragraphs and dialogue lines, no camera language. Call read_episode_script, then save_script once with the whole script.',
  },
  extractor: {
    type: 'extractor',
    scope: 'episode',
    name: 'Asset extractor',
    promptFile: 'extractor',
    skillPrefixes: ['extractor'],
    thinking: false,
    maxSteps: 20,
    defaultPrompt:
      'Extract the requested kind of asset from the episode script. Read the script, read the existing assets of that kind, then save every asset of that kind in this episode with the matching save_dedup tool, reusing existing names.',
  },
  storyboard_breaker: {
    type: 'storyboard_breaker',
    scope: 'episode',
    name: 'Storyboard breaker',
    promptFile: 'storyboard_breaker',
    skillPrefixes: ['storyboard-breaker', 'prompt-generator/video-prompt'],
    thinking: true,
    maxSteps: 20,
    defaultPrompt:
      'Split the episode script into 8-15 second shots of 2-4 sub-shots, bind the visible assets by id, and save them with save_shots in batches of at most 8; the first batch sets replaceExisting.',
  },
  prompt_generator: {
    type: 'prompt_generator',
    // An asset's prompt needs no episode (the project page's library writes it without one); a shot's does.
    scope: 'both',
    name: 'Prompt generator',
    promptFile: 'prompt_generator',
    skillPrefixes: ['prompt-generator'],
    thinking: true,
    maxSteps: 10,
    defaultPrompt:
      'Write the generation prompt for the one target named in the request. Read it first, then save the prompt with the matching save tool. Never add visual-style words.',
  },
  recap_writer: {
    type: 'recap_writer',
    scope: 'episode',
    name: 'Recap writer',
    promptFile: 'recap_writer',
    skillPrefixes: ['recap-writer'],
    thinking: false,
    maxSteps: 8,
    jobOnly: true,
    defaultPrompt:
      'Write a short recap of this episode for the writers of the next ones: what changed, where things stand, open threads; names spelled as in the script; nothing invented. Call read_episode_for_recap, then save_recap once.',
  },
  episode_writer: {
    type: 'episode_writer',
    scope: 'episode',
    name: 'Episode writer',
    promptFile: 'episode_writer',
    // The shooting-script layout is the rewriter's format skill, shared so it stays listed under the rewriter.
    skillPrefixes: ['episode-writer', 'script-rewriter/format'],
    thinking: true,
    maxSteps: 10,
    defaultPrompt:
      "Expand the episode's beat sheet into a formatted shooting script: scene headings, action paragraphs and dialogue lines, no camera language, continuous with the earlier episodes' recaps and stopping where the beats stop. Call read_episode_for_writing, then save_script once with the whole script.",
  },
  story_writer: {
    type: 'story_writer',
    scope: 'drama',
    name: 'Story writer',
    promptFile: 'story_writer',
    skillPrefixes: ['story-writer'],
    thinking: true,
    maxSteps: 8,
    defaultPrompt:
      "Write the project's story outline from its premise: logline, cast, world and tone, the story in acts with its ending, the season shape (episode count and length) and, for a serial drama, the threads across episodes; it must agree with the episodes already written or planned. Call read_story, then save_outline once with the whole outline.",
  },
  episode_planner: {
    type: 'episode_planner',
    scope: 'drama',
    name: 'Episode planner',
    promptFile: 'episode_planner',
    skillPrefixes: ['episode-planner'],
    thinking: true,
    maxSteps: 20,
    jobOnly: true,
    defaultPrompt:
      'Split the story outline into the requested number of episodes after the last existing one: each with a title, a synopsis and a beat sheet ending on the hook into the next. Call read_story_for_planning, then save_episodes in batches of at most 8 in story order, final: true on the last.',
  },
  asset_designer: {
    type: 'asset_designer',
    scope: 'drama',
    name: 'Asset designer',
    promptFile: 'asset_designer',
    // The field rules are the extractor's, shared so the two write the same kind of asset (adr-0024).
    skillPrefixes: ['asset-designer', 'extractor/fields'],
    thinking: true,
    maxSteps: 8,
    jobOnly: true,
    defaultPrompt:
      "Design the requested kind of asset (characters, scenes or props) for the whole project from its story outline, named exactly as the outline names them. Call read_story_for_design, then the matching read_existing tool, then save the whole set once with the matching save_designed tool; never overwrite what exists. When the request names one asset to describe, write that one with the matching describe tool and nothing else.",
  },
};

/** The agent that primarily owns a skill id (its first prefix match), for grouping in the UI. */
export function agentOfSkill(id: string): AgentType | null {
  const owner = (Object.values(AGENTS) as AgentDefinition[]).find((a) =>
    a.skillPrefixes.some((p, i) => i === 0 && (id === p || id.startsWith(`${p}/`))),
  );
  return owner?.type ?? null;
}

export const skillBelongsTo = (def: AgentDefinition, id: string) =>
  def.skillPrefixes.some((p) => id === p || id.startsWith(`${p}/`));
