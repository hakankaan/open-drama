import type { Logger } from 'pino';
import type { AgentType, ContentLanguage } from '@open-drama/contracts';

/** Scope of one agent run. Tools read their scope only from here, never from model input. */
export interface AgentContext {
  agentType: AgentType;
  episodeId: number;
  dramaId: number;
  language: ContentLanguage;
  log: Logger;
  /** When the run is about one asset or shot, the only one its save tools may write. */
  target?: { kind: 'character' | 'scene' | 'prop' | 'shot'; id: number };
  /** The breakdown job the run belongs to; save_shots parks and tags shots with it. */
  jobId?: number;
}
