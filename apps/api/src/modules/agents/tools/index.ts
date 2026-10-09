import type { AgentType } from '@open-drama/contracts';
import { AGENTS } from '../agents/definitions';
import type { ToolSpec } from '../runtime/tool';
import {
  readExistingCharacters,
  readExistingProps,
  readExistingScenes,
  readScriptForExtraction,
  saveDedupCharacters,
  saveDedupProps,
  saveDedupScenes,
} from './extract';
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
};

/** A drama-scoped agent runs without an episode, so an episode tool in its set would read an absent scope (adr-0015). */
export function checkAgentToolScopes(): void {
  for (const def of Object.values(AGENTS)) {
    if (def.scope !== 'drama') continue;
    const stray = AGENT_TOOLS[def.type].filter((t) => t.scope !== 'drama').map((t) => t.id);
    if (stray.length > 0) throw new Error(`The drama-scoped agent ${def.type} carries episode tools: ${stray.join(', ')}`);
  }
}
