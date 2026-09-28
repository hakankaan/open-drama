import type { AgentType } from '@open-drama/contracts';
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
import { readEpisodeScript, saveScript } from './script';
import { readStoryboardContext, saveShotsTool, updateShotTool } from './storyboard';

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
};
