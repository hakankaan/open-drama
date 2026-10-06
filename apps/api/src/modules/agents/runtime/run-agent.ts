import type { AgentRunResult, AgentType } from '@open-drama/contracts';
import { ApiError } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { scrubSecrets } from '../../../lib/secrets';
import { getAppSettings } from '../../configuration/settings';
import { AGENTS } from '../agents/definitions';
import { AGENT_TOOLS } from '../tools';
import type { AgentContext } from './context';
import { assembleInstructions } from './instructions';
import { resolveTextModel } from './model';
import { isApiCallError, runToolLoop, type RunLoopResult, type ToolCallRecord } from './sdk';

export interface RunAgentInput {
  agentType: AgentType;
  message: string;
  episodeId: number;
  dramaId: number;
  model?: string;
  textServiceId?: number;
  maxSteps?: number;
  target?: AgentContext['target'];
  jobId?: number;
  scriptRevision?: number;
  /** Ends the loop as soon as this holds (the result is already saved). */
  isDone?: (calls: ToolCallRecord[]) => boolean;
}

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
  return err instanceof Error ? err.message : String(err);
}

/** RunAgent: one tool loop scoped to a drama and episode (Plan 2 §4). Throws ApiError on failure. */
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
  const ctx: AgentContext = {
    agentType: input.agentType,
    episodeId: input.episodeId,
    dramaId: input.dramaId,
    language,
    log: logger.child({ agent: input.agentType, episodeId: input.episodeId, model: resolved.modelId }),
    target: input.target,
    jobId: input.jobId,
    scriptRevision: input.scriptRevision,
  };
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
      isDone: input.isDone,
    });
    const elapsedMs = Math.round(performance.now() - started);
    ctx.log.info(
      { steps: result.steps, tools: result.toolCalls.length, finishReason: result.finishReason, elapsedMs },
      'agent run finished',
    );
    return { ...result, elapsedMs, model: resolved.modelId };
  } catch (err) {
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
 */
export async function runAgentUntilDone(input: RunAgentInput, isDone: (calls: ToolCallRecord[]) => boolean, missing: string) {
  const first = await runAgent({ ...input, isDone });
  if (isDone(first.toolCalls)) return first;
  logger.warn(
    { agent: input.agentType, missing, finishReason: first.finishReason, stepLimitReached: first.stepLimitReached },
    'agent finished without saving; retrying once',
  );
  const second = await runAgent({ ...input, isDone, message: `${input.message}\n\nImportant: the previous attempt ended before ${missing}. ${REMINDER}` });
  if (isDone(second.toolCalls)) return second;
  throw new ApiError('PROVIDER_ERROR', `The agent finished before ${missing}.${whyUnsaved(second)} Try again or pick another model.`);
}

/** runAgentUntilDone for the usual case: done once the named save tool succeeded. */
export const runAgentUntilSaved = (input: RunAgentInput, saveTool: string) =>
  runAgentUntilDone(input, (calls) => calls.some((c) => c.tool === saveTool && c.ok), `calling ${saveTool}`);
