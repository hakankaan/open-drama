import type { AgentType } from '@open-drama/contracts';

export interface AgentDefinition {
  type: AgentType;
  name: string;
  /** Prompt file base name under prompts/. */
  promptFile: string;
  /** Every skill whose id starts with one of these is injected into the instructions. */
  skillPrefixes: string[];
  maxSteps: number;
  /** Built-in fallback when the workspace has no prompt file. */
  defaultPrompt: string;
}

export const AGENTS: Record<AgentType, AgentDefinition> = {
  script_rewriter: {
    type: 'script_rewriter',
    name: 'Script rewriter',
    promptFile: 'script_rewriter',
    skillPrefixes: ['script-rewriter'],
    maxSteps: 20,
    defaultPrompt:
      'Rewrite the episode raw content into a formatted shooting script: scene headings, action paragraphs and dialogue lines, no camera language. Call read_episode_script, then save_script once with the whole script.',
  },
  extractor: {
    type: 'extractor',
    name: 'Asset extractor',
    promptFile: 'extractor',
    skillPrefixes: ['extractor'],
    maxSteps: 20,
    defaultPrompt:
      'Extract the requested kind of asset from the episode script. Read the script, read the existing assets of that kind, then save every asset of that kind in this episode with the matching save_dedup tool, reusing existing names.',
  },
  storyboard_breaker: {
    type: 'storyboard_breaker',
    name: 'Storyboard breaker',
    promptFile: 'storyboard_breaker',
    skillPrefixes: ['storyboard-breaker', 'prompt-generator/video-prompt'],
    maxSteps: 20,
    defaultPrompt:
      'Split the episode script into 8-15 second shots of 2-4 sub-shots, bind the visible assets by id, and save them with save_shots in batches of at most 8; the first batch sets replaceExisting.',
  },
  prompt_generator: {
    type: 'prompt_generator',
    name: 'Prompt generator',
    promptFile: 'prompt_generator',
    skillPrefixes: ['prompt-generator'],
    maxSteps: 10,
    defaultPrompt:
      'Write the generation prompt for the one target named in the request. Read it first, then save the prompt with the matching save tool. Never add visual-style words.',
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
