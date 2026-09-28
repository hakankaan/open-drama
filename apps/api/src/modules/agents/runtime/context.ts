import type { Logger } from 'pino';
import type { AgentType, ContentLanguage } from '@open-drama/contracts';

/** Scope of one agent run. Tools read their scope only from here, never from model input. */
export interface AgentContext {
  agentType: AgentType;
  episodeId: number;
  dramaId: number;
  language: ContentLanguage;
  log: Logger;
  /** When the run is about one asset, the only asset its save tools may write. */
  target?: { kind: 'character' | 'scene' | 'prop'; id: number };
}
