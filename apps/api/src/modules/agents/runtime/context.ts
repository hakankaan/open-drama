import type { Logger } from 'pino';
import type { AgentType, ContentLanguage } from '@open-drama/contracts';

/** Scope of a drama-scoped agent run (story writer, episode planner). Tools read their scope only from here, never from model input. */
export interface DramaAgentContext {
  agentType: AgentType;
  dramaId: number;
  language: ContentLanguage;
  log: Logger;
  /** The job the run belongs to; the planner keeps its state on the job's progress row, save_shots parks shots with it. */
  jobId?: number;
  /** A run started from the chat endpoint: its saves are creator edits, held to the locks the creator's own edits are. */
  chat?: boolean;
  /** When the run is about one asset or shot, the only one its save tools may write. */
  target?: { kind: 'character' | 'scene' | 'prop' | 'shot'; id: number };
  /** A describe run that may write over the target's filled fields (adr-0016's replace); set by the service, never read from model input. */
  replace?: boolean;
}

/** Scope of an episode-scoped agent run: the drama scope plus the episode (adr-0015). */
export interface AgentContext extends DramaAgentContext {
  episodeId: number;
  /** The script revision a recap job started from; save_recap pins to it and is refused once the script moved on. */
  scriptRevision?: number;
}

/** A tool's scope: the context it needs. */
export type AgentScope = 'drama' | 'episode';

/** The scope an agent runs in: fixed, or either, decided per run by whether an episode is given (the prompt generator, adr-0024). */
export type AgentRunScope = AgentScope | 'both';
