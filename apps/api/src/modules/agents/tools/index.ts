import { AssetKind, DesignTarget, type AgentType } from '@open-drama/contracts';
import { AGENTS } from '../agents/definitions';
import type { ToolSpec } from '../runtime/tool';
import {
  describeCharacter,
  describeProp,
  describeScene,
  readExistingCharacters,
  readExistingProps,
  readExistingScenes,
  readStoryForDesign,
  saveDesignedCharacters,
  saveDesignedProps,
  saveDesignedScenes,
} from './design';
import { readScriptForExtraction, saveDedupCharacters, saveDedupProps, saveDedupScenes } from './extract';
import {
  readCharacters,
  readProps,
  readScenes,
  saveCharacterFinalPrompt,
  savePropFinalPrompt,
  saveSceneFinalPrompt,
} from './image-prompts';
import { readStoryForPlanning, saveEpisodes } from './plan';
import { readEpisodeForRecap, saveRecap } from './recap';
import { readEpisodeScript, saveScript } from './script';
import { readStoryboardContext, saveShotsTool, updateShotTool } from './storyboard';
import { readStory, saveOutline } from './story';
import { readEpisodeForWriting } from './write';

/** Each agent's fixed tool set. */
export const AGENT_TOOLS: Record<AgentType, ToolSpec[]> = {
  script_rewriter: [readEpisodeScript, saveScript],
  extractor: [
    readScriptForExtraction,
    readExistingCharacters,
    readExistingScenes,
    readExistingProps,
    saveDedupCharacters,
    saveDedupScenes,
    saveDedupProps,
  ],
  storyboard_breaker: [readStoryboardContext, saveShotsTool, updateShotTool],
  prompt_generator: [
    readCharacters,
    readScenes,
    readProps,
    saveCharacterFinalPrompt,
    saveSceneFinalPrompt,
    savePropFinalPrompt,
    readStoryboardContext,
    updateShotTool,
  ],
  recap_writer: [readEpisodeForRecap, saveRecap],
  episode_writer: [readEpisodeForWriting, saveScript],
  story_writer: [readStory, saveOutline],
  episode_planner: [readStoryForPlanning, saveEpisodes],
  asset_designer: [
    readStoryForDesign,
    readExistingCharacters,
    readExistingScenes,
    readExistingProps,
    saveDesignedCharacters,
    saveDesignedScenes,
    saveDesignedProps,
    describeCharacter,
    describeScene,
    describeProp,
  ],
};

/**
 * The tools a design run offers (adr-0024): the story, the kind's existing assets and the kind's one save, so a run
 * for one kind cannot save another. A run allowlist is a subset of its agent's set, which the boot check reads.
 */
export const DESIGN_RUN_TOOLS: Record<DesignTarget, string[]> = Object.fromEntries(
  DesignTarget.options.map((t) => [t, ['read_story_for_design', `read_existing_${t}`, `save_designed_${t}`]]),
) as Record<DesignTarget, string[]>;

const PLURAL: Record<AssetKind, DesignTarget> = { character: 'characters', scene: 'scenes', prop: 'props' };

/** The tools a describe run offers (adr-0024): the story, the kind's existing assets and the kind's one describe, never a bulk save. */
export const DESCRIBE_RUN_TOOLS: Record<AssetKind, string[]> = Object.fromEntries(
  AssetKind.options.map((k) => [k, ['read_story_for_design', `read_existing_${PLURAL[k]}`, `describe_${k}`]]),
) as Record<AssetKind, string[]>;

/** Every run allowlist a service names, beside its agent, so a renamed tool fails at boot and not in a job. */
const RUN_ALLOWLISTS: { agent: AgentType; tools: string[] }[] = [
  ...DesignTarget.options.map((t) => ({ agent: 'asset_designer' as const, tools: DESIGN_RUN_TOOLS[t] })),
  ...AssetKind.options.map((k) => ({ agent: 'asset_designer' as const, tools: DESCRIBE_RUN_TOOLS[k] })),
];

/**
 * A drama-scoped agent runs without an episode, so an episode tool in its set would read an absent scope (adr-0015).
 * An agent of both scopes keeps its episode tools for its episode runs; a run without an episode is offered its drama
 * tools only, so it must have at least one; and every run allowlist names tools of its agent (adr-0024).
 */
export function checkAgentToolScopes(): void {
  for (const def of Object.values(AGENTS)) {
    if (def.scope === 'episode') continue;
    const stray = AGENT_TOOLS[def.type].filter((t) => t.scope !== 'drama').map((t) => t.id);
    if (def.scope === 'drama' && stray.length > 0) {
      throw new Error(`The drama-scoped agent ${def.type} carries episode tools: ${stray.join(', ')}`);
    }
    if (def.scope === 'both' && stray.length === AGENT_TOOLS[def.type].length) {
      throw new Error(`The agent ${def.type} runs in both scopes but carries no drama tool`);
    }
  }
  for (const { agent, tools } of RUN_ALLOWLISTS) {
    const unknown = tools.filter((id) => !AGENT_TOOLS[agent].some((t) => t.id === id));
    if (unknown.length > 0) throw new Error(`A run allowlist of ${agent} names tools it does not have: ${unknown.join(', ')}`);
  }
}
