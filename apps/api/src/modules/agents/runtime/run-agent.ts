import type { AgentRunResult, AgentType, ContentLanguage } from '@open-drama/contracts';
import { ApiError } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { scrubSecrets } from '../../../lib/secrets';
import { getAppSettings } from '../../configuration/settings';
import { AGENTS } from '../agents/definitions';
import { AGENT_TOOLS } from '../tools';
import type { AgentContext, DramaAgentContext } from './context';
import { assembleInstructions } from './instructions';
import { resolveTextModel } from './model';
import { isApiCallError, runToolLoop, type RunLoopResult, type ToolCallRecord } from './sdk';

export interface RunAgentInput {
  agentType: AgentType;
  message: string;
  /** Required by an episode-scoped agent, absent for a drama-scoped one (adr-0015). */
  episodeId?: number;
  dramaId: number;
  model?: string;
  textServiceId?: number;
  maxSteps?: number;
  target?: AgentContext['target'];
  jobId?: number;
  /** Started from the chat endpoint (see DramaAgentContext.chat). */
  chat?: boolean;
  scriptRevision?: number;
  /** The job's cancel signal: the run stops at its next provider or tool call. */
  signal?: AbortSignal;
  /** Ends the loop as soon as this holds (the result is already saved). */
  isDone?: (calls: ToolCallRecord[]) => boolean;
}

/** One provider call (one step of the loop) longer than this is abandoned, so a hung request cannot hold a job forever. */
const STEP_TIMEOUT_MS = 10 * 60_000;

const isTimeout = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'TimeoutError' || (err.cause !== undefined && isTimeout(err.cause)));

/** A provider-side failure worded for the creator; the key never appears in it (echoes are scrubbed). */
function describeError(err: unknown): string {
  return scrubSecrets(wordError(err));
}

function wordError(err: unknown): string {
  if (isApiCallError(err)) {
    const status = err.statusCode ? ` (${err.statusCode})` : '';
    if (err.statusCode === 401 || err.statusCode === 403) return `The text provider rejected the API key${status}`;
    if (err.statusCode === 429) return `The text provider's rate limit or quota was reached${status}`;
    return `The text provider returned an error${status}: ${err.message.slice(0, 300)}`;
  }
  if (isTimeout(err)) return `The text provider did not answer within ${STEP_TIMEOUT_MS / 60_000} minutes`;
  return err instanceof Error ? err.message : String(err);
}

/** The run's context for its agent's scope: an episode-scoped agent without an episode is a programming error. */
function contextFor(input: RunAgentInput, language: ContentLanguage, modelId: string): DramaAgentContext {
  const def = AGENTS[input.agentType];
  const base: DramaAgentContext = {
    agentType: input.agentType,
    dramaId: input.dramaId,
    language,
    log: logger.child({ agent: input.agentType, dramaId: input.dramaId, episodeId: input.episodeId, model: modelId }),
    jobId: input.jobId,
    chat: input.chat,
  };
  if (def.scope === 'drama') return base;
  if (input.episodeId === undefined) throw new ApiError('INTERNAL', `The ${def.name} runs on an episode`);
  const ctx: AgentContext = { ...base, episodeId: input.episodeId, target: input.target, scriptRevision: input.scriptRevision };
  return ctx;
}

/** RunAgent: one tool loop scoped to a drama or to one of its episodes (Plan 2 §4, adr-0015). Throws ApiError on failure. */
export async function runAgent(input: RunAgentInput): Promise<AgentRunResult & RunLoopResult> {
  const def = AGENTS[input.agentType];
  const language = getAppSettings().contentLanguage;
  const { instructions, promptModel } = assembleInstructions(input.agentType, language);
  const resolved = resolveTextModel({
    agentType: input.agentType,
    modelOverride: input.model,
    promptModel,
    textServiceId: input.textServiceId,
  });
  const ctx = contextFor(input, language, resolved.modelId);
  const started = performance.now();
  ctx.log.info({ language }, 'agent run started');
  try {
    const result = await runToolLoop({
      model: resolved.model,
      instructions,
      message: input.message,
      tools: AGENT_TOOLS[input.agentType],
      ctx,
      maxSteps: input.maxSteps ?? def.maxSteps,
      temperature: resolved.temperature,
      abortSignal: input.signal,
      stepTimeoutMs: STEP_TIMEOUT_MS,
      isDone: input.isDone,
    });
    const elapsedMs = Math.round(performance.now() - started);
    ctx.log.info(
      { steps: result.steps, tools: result.toolCalls.length, finishReason: result.finishReason, elapsedMs },
      'agent run finished',
    );
    return { ...result, elapsedMs, model: resolved.modelId };
  } catch (err) {
    if (input.signal?.aborted) {
      ctx.log.info('agent run stopped');
      throw new Error('Cancelled');
    }
    const message = describeError(err);
    ctx.log.warn({ err: message }, 'agent run failed');
    throw new ApiError('PROVIDER_ERROR', message);
  }
}

const REMINDER = 'You must call the save tool described above with the complete result; the task only counts once it is saved.';

/** Why a run ended without its side effect, worded for the creator; empty when nothing specific is known. */
function whyUnsaved(run: RunLoopResult): string {
  if (run.finishReason === 'length') {
    return " The model's answer was cut off at its output limit: pick a model with a larger output, or raise OPEN_DRAMA_AI_MAX_TOKENS for a relay.";
  }
  if (run.finishReason === 'content-filter') return " The provider's content filter stopped the answer.";
  if (run.stepLimitReached) return ` It used all ${run.steps} steps of its budget.`;
  return '';
}

/**
 * Runs an agent and checks the expected side effect: `isDone` must hold after the run (for most agents, the save
 * tool succeeded). One retry with a reminder, then a failure naming the problem (Plan 2 §4, domain AgentRun).
 * `retryMessage`, read after the first attempt, replaces the message for the retry when what that attempt already
 * saved changes the task (the breakdown continues its batches instead of starting over).
 */
export async function runAgentUntilDone(
  input: RunAgentInput,
  isDone: (calls: ToolCallRecord[]) => boolean,
  missing: string,
  retryMessage?: () => string,
) {
  const first = await runAgent({ ...input, isDone });
  if (isDone(first.toolCalls)) return first;
  input.signal?.throwIfAborted();
  logger.warn(
    { agent: input.agentType, missing, finishReason: first.finishReason, stepLimitReached: first.stepLimitReached },
    'agent finished without saving; retrying once',
  );
  const message = retryMessage?.() ?? input.message;
  const second = await runAgent({ ...input, isDone, message: `${message}\n\nImportant: the previous attempt ended before ${missing}. ${REMINDER}` });
  if (isDone(second.toolCalls)) return second;
  throw new ApiError('PROVIDER_ERROR', `The agent finished before ${missing}.${whyUnsaved(second)} Try again or pick another model.`);
}

/** runAgentUntilDone for the usual case: done once the named save tool succeeded. */
export const runAgentUntilSaved = (input: RunAgentInput, saveTool: string) =>
  runAgentUntilDone(input, (calls) => calls.some((c) => c.tool === saveTool && c.ok), `calling ${saveTool}`);
