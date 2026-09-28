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

/** Each agent's fixed tool set. The storyboard tools arrive with the breakdown (M3). */
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
  storyboard_breaker: [],
  prompt_generator: [readCharacters, readScenes, readProps, saveCharacterFinalPrompt, saveSceneFinalPrompt, savePropFinalPrompt],
};
