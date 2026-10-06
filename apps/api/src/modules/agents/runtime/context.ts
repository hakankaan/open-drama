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
  /** The breakdown or recap job the run belongs to; save_shots parks and tags shots with it. */
  jobId?: number;
  /** The script revision a recap job started from; save_recap pins to it and is refused once the script moved on. */
  scriptRevision?: number;
}
