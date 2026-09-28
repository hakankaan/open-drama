import type { AgentRunResult, AgentType } from '@open-drama/contracts';
import { ApiError } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { getAppSettings } from '../../configuration/settings';
import { AGENTS } from '../agents/definitions';
import { AGENT_TOOLS } from '../tools';
import type { AgentContext } from './context';
import { assembleInstructions } from './instructions';
import { resolveTextModel } from './model';
import { isApiCallError, runToolLoop, type ToolCallRecord } from './sdk';

export interface RunAgentInput {
  agentType: AgentType;
  message: string;
  episodeId: number;
  dramaId: number;
  model?: string;
  textServiceId?: number;
  maxSteps?: number;
  target?: AgentContext['target'];
  /** Ends the loop as soon as this tool succeeds (the result is already saved). */
  stopAfterTool?: string;
}

/** A provider-side failure worded for the creator; the key never appears in it. */
function describeError(err: unknown): string {
  if (isApiCallError(err)) {
    const status = err.statusCode ? ` (${err.statusCode})` : '';
    if (err.statusCode === 401 || err.statusCode === 403) return `The text provider rejected the API key${status}`;
    if (err.statusCode === 429) return `The text provider's rate limit or quota was reached${status}`;
    return `The text provider returned an error${status}: ${err.message.slice(0, 300)}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** RunAgent: one tool loop scoped to a drama and episode (Plan 2 §4). Throws ApiError on failure. */
export async function runAgent(input: RunAgentInput): Promise<AgentRunResult & { toolCalls: ToolCallRecord[] }> {
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
      stopAfterTool: input.stopAfterTool,
    });
    const elapsedMs = Math.round(performance.now() - started);
    ctx.log.info({ steps: result.steps, tools: result.toolCalls.length, elapsedMs }, 'agent run finished');
    return { ...result, elapsedMs, model: resolved.modelId };
  } catch (err) {
    const message = describeError(err);
    ctx.log.warn({ err: message }, 'agent run failed');
    throw new ApiError('PROVIDER_ERROR', message);
  }
}

const REMINDER =
  '\n\nImportant: the previous attempt ended without saving. You must call the save tool described above with the complete result; the task only counts once it is saved.';

/**
 * Runs an agent and checks the expected side effect: the named save tool must have succeeded. One retry with a
 * reminder, then a failure naming the problem (Plan 2 §4, domain AgentRun).
 */
export async function runAgentUntilSaved(input: RunAgentInput, saveTool: string) {
  const saved = (calls: ToolCallRecord[]) => calls.some((c) => c.tool === saveTool && c.ok);
  const first = await runAgent({ ...input, stopAfterTool: saveTool });
  if (saved(first.toolCalls)) return first;
  logger.warn({ agent: input.agentType, saveTool }, 'agent finished without saving; retrying once');
  const second = await runAgent({ ...input, stopAfterTool: saveTool, message: input.message + REMINDER });
  if (saved(second.toolCalls)) return second;
  throw new ApiError('PROVIDER_ERROR', `The agent finished without calling ${saveTool}. Try again or pick another model.`);
}
